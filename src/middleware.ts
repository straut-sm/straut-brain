import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Renova a sessão da Straut a cada requisição (cookies do Supabase Auth). */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  // Confere o login localmente e renova a sessão só quando estiver vencendo.
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  // Páginas da Straut (o link das clientes /p/... não usa o login da Straut)
  matcher: ["/", "/c/:path*", "/login"],
};
