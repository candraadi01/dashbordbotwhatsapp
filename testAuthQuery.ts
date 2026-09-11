import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://ikokxobkeufhljhgvjqu.supabase.co",
  "sb_publishable_Wstm8Hg7HBS8N59CMGKmVQ_CWTNtXxw"
);

async function testQuery() {
  const { data: { user }, error: authError } = await supabase.auth.signInWithPassword({
    email: 'candra@admin.com',
    password: 'password123' // Just guessing, probably won't work
  });
  console.log("Auth:", user?.email, authError?.message);

  const { data, error } = await supabase.from('transactions').select('*').limit(5);
  console.log("Data length:", data?.length);
  console.log("Error:", error);
}

testQuery();
