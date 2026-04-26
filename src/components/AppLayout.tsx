import { ReactNode } from "react";
import { SideNav } from "./SideNav";

export const AppLayout = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen w-full">
    <SideNav />
    <main className="ml-20 transition-all duration-500 animate-fade-in">
      {children}
    </main>
  </div>
);
