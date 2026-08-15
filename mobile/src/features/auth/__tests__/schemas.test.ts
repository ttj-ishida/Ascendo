import { signUpSchema, logInSchema, forgotPasswordSchema, resetPasswordSchema } from '../schemas';

test('signUpSchema accepts matching passwords >= 8 chars and a valid email', () => {
  const result = signUpSchema.safeParse({
    email: 'user@example.com',
    password: 'password123',
    confirmPassword: 'password123',
  });
  expect(result.success).toBe(true);
});

test('signUpSchema rejects mismatched passwords', () => {
  const result = signUpSchema.safeParse({
    email: 'user@example.com',
    password: 'password123',
    confirmPassword: 'different1',
  });
  expect(result.success).toBe(false);
});

test('signUpSchema rejects a password shorter than 8 characters', () => {
  const result = signUpSchema.safeParse({
    email: 'user@example.com',
    password: 'short1',
    confirmPassword: 'short1',
  });
  expect(result.success).toBe(false);
});

test('signUpSchema rejects an invalid email', () => {
  const result = signUpSchema.safeParse({
    email: 'not-an-email',
    password: 'password123',
    confirmPassword: 'password123',
  });
  expect(result.success).toBe(false);
});

test('logInSchema accepts any non-empty password (strength is only enforced at signup)', () => {
  expect(logInSchema.safeParse({ email: 'user@example.com', password: 'x' }).success).toBe(true);
  expect(logInSchema.safeParse({ email: 'user@example.com', password: '' }).success).toBe(false);
});

test('forgotPasswordSchema requires a valid email', () => {
  expect(forgotPasswordSchema.safeParse({ email: 'user@example.com' }).success).toBe(true);
  expect(forgotPasswordSchema.safeParse({ email: 'nope' }).success).toBe(false);
});

test('resetPasswordSchema requires matching passwords >= 8 chars', () => {
  expect(
    resetPasswordSchema.safeParse({ password: 'password123', confirmPassword: 'password123' }).success,
  ).toBe(true);
  expect(
    resetPasswordSchema.safeParse({ password: 'password123', confirmPassword: 'nomatch12' }).success,
  ).toBe(false);
});
