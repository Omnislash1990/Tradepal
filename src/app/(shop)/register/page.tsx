import { RegisterForm } from "./register-form";

export const metadata = { title: "Create account" };

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const sp = await searchParams;
  return <RegisterForm next={typeof sp.next === "string" ? sp.next : "/account"} />;
}
