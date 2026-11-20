const NEW_SUPABASE_URL = 'https://wobaeeyxtkewpbwgwcph.supabase.co';
const SECRET_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function createUser(email, password) {
  if (!email || !password) {
    console.error('Usage: node create_user.cjs <email> <password>');
    process.exit(1);
  }

  const res = await fetch(`${NEW_SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'apikey': SECRET_KEY,
      'Authorization': `Bearer ${SECRET_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'admin' }
    })
  });

  const data = await res.json();
  if (!res.ok) {
    console.error('Failed to create user:', data);
  } else {
    console.log(`User created successfully:`);
    console.log(`ID: ${data.id}`);
    console.log(`Email: ${data.email}`);
  }
}

const email = process.argv[2] || 'admin@sftgaz.com';
const password = process.argv[3] || 'Admin123456!';

createUser(email, password);
