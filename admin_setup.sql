-- Create the admin profile required by the protected admin application.
-- First create this user in Supabase Dashboard -> Authentication -> Users.
-- Then replace the email below and run this script once.

DO $$
DECLARE
    admin_email TEXT := 'kizigamer52@gmail.com';
    admin_user_id UUID;
BEGIN
    IF admin_email = 'REPLACE_WITH_ADMIN_EMAIL' THEN
        RAISE EXCEPTION 'Replace REPLACE_WITH_ADMIN_EMAIL before running this script';
    END IF;

    SELECT id INTO admin_user_id
    FROM auth.users
    WHERE LOWER(email) = LOWER(admin_email)
    LIMIT 1;

    IF admin_user_id IS NULL THEN
        RAISE EXCEPTION 'No Supabase Authentication user exists for %', admin_email;
    END IF;

    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (admin_user_id, LOWER(admin_email), 'Aravalli Administrator', 'admin')
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        role = 'admin',
        updated_at = NOW();
END;
$$;

NOTIFY pgrst, 'reload schema';
