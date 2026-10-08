import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Cuboid, Landmark, ShieldCheck, Users } from "lucide-react";
import { useSyncExternalStore, type ReactNode } from "react";
import community from "@/assets/community.jpg";
import { COOP_NAME } from "@/lib/membership";

const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function AuthLayout({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const ready = useSyncExternalStore(subscribe, clientReady, serverReady);
  return (
    <div className="auth-layout">
      <aside className="auth-story">
        <Link to="/login" className="auth-brand">
          <span className="brand-mark">
            <Cuboid size={25} />
          </span>
          {COOP_NAME}
        </Link>
        <div className="auth-story-copy">
          <span className="auth-overline">THE COMMUNITY PHARMACISTS' COOPERATIVE</span>
          <h2>
            A stronger future.
            <br />
            Built together.
          </h2>
          <p>
            Save with purpose. Invest in your community. Grow alongside people who share your
            calling.
          </p>
          <div className="auth-benefits">
            <div>
              <Landmark size={19} />
              <span>Build your savings, one contribution at a time.</span>
            </div>
            <div>
              <Users size={19} />
              <span>A community of licensed pharmacists.</span>
            </div>
            <div>
              <ShieldCheck size={19} />
              <span>Transparent records. Shared progress.</span>
            </div>
          </div>
        </div>
        <div className="auth-image">
          <img src={community} alt="Illustration of community investment in Lagos" />
          <div>
            <span>Our community. Our shared future.</span>
            <ArrowUpRight size={19} />
          </div>
        </div>
        <p className="auth-story-footer">
          ACPN IDEA COOP <span>Growing through trust.</span>
        </p>
      </aside>
      <div className="auth-main">
        <div className="auth-mobile-brand">
          <Cuboid size={24} />
          {COOP_NAME}
        </div>
        <main inert={!ready} className={`auth-content ${wide ? "auth-content-wide" : ""}`}>
          {children}
        </main>
        <footer className="auth-footer">
          <ShieldCheck size={14} />
          <span>Demo experience · Accounts and activity reset when you refresh.</span>
        </footer>
      </div>
    </div>
  );
}
