import { Link } from "@tanstack/react-router";
import { Headphones, ShieldCheck } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-secondary/40">
      <div className="container mx-auto grid gap-10 px-4 py-12 md:grid-cols-4">
        <div className="space-y-3">
          <div className="font-display text-lg font-semibold">All Video Downloader</div>
          <p className="text-sm text-muted-foreground">
            Download and convert media from public web pages — responsibly, safely, and with respect
            for copyright.
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 text-primary" aria-hidden />
            Privacy-first. Minimal retention.
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold">Product</h3>
          <ul className="space-y-2 text-sm">
            <li><Link to="/tool" className="text-muted-foreground hover:text-foreground">Convert & Download</Link></li>
            <li><Link to="/how-it-works" className="text-muted-foreground hover:text-foreground">How it works</Link></li>
            <li><Link to="/faq" className="text-muted-foreground hover:text-foreground">FAQ</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold">Support</h3>
          <ul className="space-y-2 text-sm">
            <li><Link to="/help" className="text-muted-foreground hover:text-foreground">Help & Helpline</Link></li>
            <li><Link to="/contact" className="text-muted-foreground hover:text-foreground">Contact</Link></li>
            <li className="flex items-center gap-2 text-muted-foreground">
              <Headphones className="size-4" aria-hidden />
              +1 (555) 010-2040
            </li>
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold">Legal</h3>
          <ul className="space-y-2 text-sm">
            <li><Link to="/terms" className="text-muted-foreground hover:text-foreground">Terms of Service</Link></li>
            <li><Link to="/privacy" className="text-muted-foreground hover:text-foreground">Privacy Policy</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="container mx-auto flex flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground md:flex-row">
          <span>© {new Date().getFullYear()} All Video Downloader. All rights reserved.</span>
          <span>Governed by the laws of [Your Jurisdiction].</span>
        </div>
      </div>
    </footer>
  );
}
