import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://ikokxobkeufhljhgvjqu.supabase.co",
  "sb_publishable_Wstm8Hg7HBS8N59CMGKmVQ_CWTNtXxw"
);

async function test() {
  const { data, error } = await supabase.from("transactions").select("*").limit(5);
  console.log("Data length:", data?.length);
  console.log("Error:", error);
}

test();
