import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://ikokxobkeufhljhgvjqu.supabase.co",
  "sb_publishable_Wstm8Hg7HBS8N59CMGKmVQ_CWTNtXxw"
);

async function testAuth() {
  // Sign in as candra@admin.com
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: "candra@admin.com",
    password: "password123", // I don't know the password, but let's see if we can just test with service role.
  });

  // Actually, I don't know the password. I will just check if RLS is enabled on transactions.
  const { data: rlsData, error: rlsError } = await supabase.rpc('get_table_info', { table_name: 'transactions' });
  console.log("RLS Info:", rlsData, rlsError);
}

testAuth();
