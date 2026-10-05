'use client'; 

import { Show, SignInButton, SignUpButton, UserButton, useUser } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "cn";

const navItems = [
    {label: "Library", href: "/" },
    {label: "Add New", href: "/books/new"},
]

const Navbar = () => {
    const pathName = usePathname();
    const { user } = useUser();

    return (
        <header className="w-full fixed z-50 bg-('--bg-primary')">
            <div className="wrapper navabr-height py-4 flex justify-between items-center">
                <Link href="/" className="flex gap-0.5 items-center">
                    <Image src="/logo.png" alt="LibBot logo" loading="eager" width={45} height={45} />
                    <span className="logo-text">LibBot</span>
                </Link>

        <nav className="w-fit flex gap-7.5 items-center">
          {navItems.map(({ label, href }) => {
            const isActive =
              pathName === href || (href !== "/" && pathName.startsWith(href));

            return (
              <Link
                key={label}
                href={href}
                className={cn(
                  "nav-link-base",
                  isActive ? "nav-link-active" : "text-black hover:opacity-70"
                )}
              >
                {label}
              </Link>
            );
          })}

          <Show when="signed-out">
            <SignInButton>
              <button type="button" className="nav-link-base text-black hover:opacity-70">
                Sign in
              </button>
            </SignInButton>
            <SignUpButton>
              <button type="button" className="nav-link-base text-black hover:opacity-70">
                Sign up
              </button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <div className="nav-user-link">
                <UserButton />
                {user?.firstName && (
                    <Link href="/subscriptions"
                    className="nav-user-name">
                        {user.firstName}
                    </Link>
                )}
            </div>
          </Show>
        </nav>
      </div>
    </header>
  );
};

export default Navbar;