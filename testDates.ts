import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://ikokxobkeufhljhgvjqu.supabase.co",
  "sb_publishable_Wstm8Hg7HBS8N59CMGKmVQ_CWTNtXxw"
);

async function checkAuthAndFetch() {
  // Try to query normally first
  let { data: anonData, error: anonErr } = await supabase.from("transactions").select("id").limit(1);
  console.log("Anon fetch:", anonData?.length, anonErr);

  // Authenticate (if possible, but we don't know the password).
  // Wait, I can't login without password.
  // Is it possible to check if RLS is enabled by trying to query pg_class?
  // We can't query pg_class from client API unless we use rpc.
}

checkAuthAndFetch();
