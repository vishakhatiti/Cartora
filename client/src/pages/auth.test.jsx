import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp, fakeApi, asha } from '../test/renderApp.jsx';
import { ApiError } from '../lib/api.js';

// selector: 'input' because the active tab panel is also labelled "Password" (aria-labelledby).
const field = (label) => screen.getByLabelText(label, { selector: 'input' });
const type = (label, text) => userEvent.type(field(label), text);
const signedInApi = (extra = {}) => fakeApi({ me: vi.fn().mockResolvedValue({ user: asha }), ...extra });

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
});

describe('header account area', () => {
  it('offers Sign in to guests and the account menu to signed-in users', async () => {
    const { unmount } = renderApp();
    expect(await screen.findByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in');
    unmount();
    renderApp({ api: signedInApi() });
    expect(await screen.findByRole('button', { name: /account menu for asha kulkarni/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
  });

  it('signs out from the menu and confirms with a message', async () => {
    const { api } = renderApp({ api: signedInApi() });
    await userEvent.click(await screen.findByRole('button', { name: /account menu/i }));
    expect(screen.getByRole('menuitem', { name: 'Your account' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(api.logout).toHaveBeenCalled();
    expect(await screen.findByRole('link', { name: 'Sign in' })).toBeInTheDocument();
    expect(await screen.findByText('You are signed out.')).toBeInTheDocument();
  });

  it('closes the menu with Escape', async () => {
    renderApp({ api: signedInApi() });
    await userEvent.click(await screen.findByRole('button', { name: /account menu/i }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});

describe('sign in with a password', () => {
  it('checks the fields before calling the server', async () => {
    const { api } = renderApp({ route: '/sign-in' });
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(api.login).not.toHaveBeenCalled();
  });

  it('signs in, greets the user by first name and goes home', async () => {
    const { api } = renderApp({ route: '/sign-in' });
    await type('Email', ' asha@example.com ');
    await type('Password', 'a-good-password');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(api.login).toHaveBeenCalledWith({ email: 'asha@example.com', password: 'a-good-password' });
    expect(await screen.findByText('Welcome back, Asha.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Shop smarter.');
    expect(screen.getByRole('button', { name: /account menu/i })).toBeInTheDocument();
  });

  it('shows the server message for a wrong password and keeps the form', async () => {
    const api = fakeApi({ login: vi.fn().mockRejectedValue(new ApiError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password.')) });
    renderApp({ route: '/sign-in', api });
    await type('Email', 'asha@example.com');
    await type('Password', 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.');
    expect(field('Email')).toHaveValue('asha@example.com');
  });

  it('sends an unverified account to the code step and asks for a fresh code', async () => {
    const api = fakeApi({ login: vi.fn().mockRejectedValue(new ApiError(403, 'EMAIL_NOT_VERIFIED', 'Please verify your email first.')) });
    renderApp({ route: '/sign-in', api });
    await type('Email', 'Asha@Example.com');
    await type('Password', 'a-good-password');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    expect(screen.getByText('asha@example.com')).toBeInTheDocument();
    expect(api.resendVerification).toHaveBeenCalledWith({ email: 'asha@example.com' });
  });

  it('links to register, forgot password and guest browsing', () => {
    renderApp({ route: '/sign-in' });
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/register');
    expect(screen.getByRole('link', { name: 'Forgot your password?' })).toHaveAttribute('href', '/forgot');
    expect(screen.getByRole('link', { name: 'Continue as guest' })).toHaveAttribute('href', '/');
  });

  it('redirects a signed-in visitor away from the sign-in page', async () => {
    renderApp({ route: '/sign-in', api: signedInApi() });
    // The form shows until the first /me answer arrives, then the visitor is sent home.
    expect(await screen.findByRole('heading', { name: /shop smarter/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument();
  });
});

describe('sign in with an emailed code', () => {
  async function openCodeTab() {
    await userEvent.click(screen.getByRole('tab', { name: 'Email code' }));
    expect(screen.getByRole('tab', { name: 'Email code' })).toHaveAttribute('aria-selected', 'true');
  }

  it('requests a code, then signs in with it', async () => {
    const { api } = renderApp({ route: '/sign-in' });
    await openCodeTab();
    await type('Email', 'asha@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Email me a code' }));
    expect(api.requestLoginCode).toHaveBeenCalledWith({ email: 'asha@example.com' });
    await type('6-digit code', '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(api.verifyLoginCode).toHaveBeenCalledWith({ email: 'asha@example.com', code: '123456' });
    expect(await screen.findByText('Welcome back, Asha.')).toBeInTheDocument();
  });

  it('keeps only digits and rejects a short code without calling the server', async () => {
    const { api } = renderApp({ route: '/sign-in' });
    await openCodeTab();
    await type('Email', 'asha@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Email me a code' }));
    await type('6-digit code', '12ab34');
    expect(field('6-digit code')).toHaveValue('1234');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('Enter the 6-digit code from the email.')).toBeInTheDocument();
    expect(api.verifyLoginCode).not.toHaveBeenCalled();
  });

  it('shows a wrong-code message and lets the user try again', async () => {
    const api = fakeApi({ verifyLoginCode: vi.fn().mockRejectedValueOnce(new ApiError(400, 'OTP_INVALID', 'That code is incorrect or has expired. Request a new one.')) });
    renderApp({ route: '/sign-in', api });
    await openCodeTab();
    await type('Email', 'asha@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Email me a code' }));
    await type('6-digit code', '000000');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('incorrect or has expired');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it('makes the resend button wait 60 seconds', async () => {
    renderApp({ route: '/sign-in' });
    await openCodeTab();
    await type('Email', 'asha@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Email me a code' }));
    expect(screen.getByRole('button', { name: /send a new code in \d+s/i })).toBeDisabled();
  });

  it('goes back to change the email', async () => {
    renderApp({ route: '/sign-in' });
    await openCodeTab();
    await type('Email', 'asha@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Email me a code' }));
    await userEvent.click(screen.getByRole('button', { name: 'Use a different email' }));
    expect(field('Email')).toBeInTheDocument();
  });
});

describe('register', () => {
  it('validates, registers, verifies the code and signs in', async () => {
    const { api } = renderApp({ route: '/register' });
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByText('Enter your name.')).toBeInTheDocument();
    expect(screen.getByText('Use at least 8 characters.')).toBeInTheDocument();
    expect(api.register).not.toHaveBeenCalled();

    await type('Name', 'Asha Kulkarni');
    await type('Email', 'Asha@Example.com');
    await type('Password', 'a-good-password');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(api.register).toHaveBeenCalledWith({ name: 'Asha Kulkarni', email: 'Asha@Example.com', password: 'a-good-password' });

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    await type('6-digit code', '654321');
    await userEvent.click(screen.getByRole('button', { name: 'Verify and continue' }));
    expect(api.verifyEmail).toHaveBeenCalledWith({ email: 'asha@example.com', code: '654321' });
    expect(await screen.findByText('Email verified. Welcome to Cartora.')).toBeInTheDocument();
  });

  it('shows server errors such as rate limits', async () => {
    const api = fakeApi({ register: vi.fn().mockRejectedValue(new ApiError(429, 'RATE_LIMITED', 'Too many code requests. Try again in a few minutes.')) });
    renderApp({ route: '/register', api });
    await type('Name', 'Asha');
    await type('Email', 'asha@example.com');
    await type('Password', 'a-good-password');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many code requests');
  });

  it('rejects an over-long password before sending', async () => {
    const { api } = renderApp({ route: '/register' });
    await type('Name', 'Asha');
    await type('Email', 'asha@example.com');
    await userEvent.type(field('Password'), 'x'.repeat(129), { delay: null });
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByText('Use at most 128 characters.')).toBeInTheDocument();
    expect(api.register).not.toHaveBeenCalled();
  });
});

describe('forgot password', () => {
  it('emails a code, then sets the new password and signs in', async () => {
    const { api } = renderApp({ route: '/forgot' });
    await type('Email', 'asha@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Email me a code' }));
    expect(api.forgot).toHaveBeenCalledWith({ email: 'asha@example.com' });

    const submit = await screen.findByRole('button', { name: 'Update password' });
    expect(submit).toBeDisabled(); // no password yet
    await type('6-digit code', '111222');
    await type('New password', 'a-brand-new-password');
    expect(submit).toBeEnabled();
    await userEvent.click(submit);
    expect(api.reset).toHaveBeenCalledWith({ email: 'asha@example.com', code: '111222', newPassword: 'a-brand-new-password' });
    expect(await screen.findByText('Password updated. You are signed in.')).toBeInTheDocument();
  });

  it('keeps the button disabled for a too-short new password', async () => {
    renderApp({ route: '/forgot' });
    await type('Email', 'asha@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Email me a code' }));
    await type('New password', 'short');
    expect(await screen.findByRole('button', { name: 'Update password' })).toBeDisabled();
  });
});

describe('Google sign-in', () => {
  it('shows no Google button when no client id is configured', () => {
    renderApp({ route: '/sign-in' });
    expect(screen.queryByTestId('google-button')).not.toBeInTheDocument();
  });
});

describe('account page', () => {
  it('sends guests to sign in and returns them afterwards', async () => {
    const api = fakeApi();
    renderApp({ route: '/account', api });
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    await type('Email', 'asha@example.com');
    await type('Password', 'a-good-password');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { name: 'Your account' })).toBeInTheDocument();
  });

  it('shows the signed-in details', async () => {
    renderApp({ route: '/account', api: signedInApi() });
    expect(await screen.findByRole('heading', { name: 'Your account' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('asha@example.com').length).toBeGreaterThan(0));
  });
});
