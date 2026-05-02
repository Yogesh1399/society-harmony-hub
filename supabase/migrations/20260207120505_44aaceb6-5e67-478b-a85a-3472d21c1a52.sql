-- Confirm the test user's email so they can log in
UPDATE auth.users 
SET email_confirmed_at = now(),
    confirmation_sent_at = now()
WHERE email = 'testuser@society.com'
AND email_confirmed_at IS NULL;
