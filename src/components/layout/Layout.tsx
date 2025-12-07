import { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { NotificationBar } from "./NotificationBar";
import { ChatButton } from "./ChatButton";

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="min-h-screen flex flex-col">
      <NotificationBar />
      <Navbar />
      <main className="flex-1 pt-24">{children}</main>
      <Footer />
      <ChatButton />
    </div>
  );
};
