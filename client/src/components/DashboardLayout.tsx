import { useUser, useClerk } from "@clerk/clerk-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import { LayoutDashboard, LogOut, PanelLeft, Dumbbell, Apple, TrendingUp, History } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: Dumbbell, label: "Entrenamiento", path: "/entrenamiento" },
  { icon: Apple, label: "Nutrición", path: "/nutricion" },
  { icon: TrendingUp, label: "Progreso", path: "/progreso" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const MIN_WIDTH = 240;
  const MAX_WIDTH = 360;

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    if (!saved) return DEFAULT_WIDTH;
    const parsed = parseInt(saved, 10);
    return isNaN(parsed) ? DEFAULT_WIDTH : Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, parsed));
  });

  useEffect(() => {
    const width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, sidebarWidth));
    localStorage.setItem(SIDEBAR_WIDTH_KEY, width.toString());
  }, [sidebarWidth]);

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, sidebarWidth))}px`,
          "--sidebar-width-icon": "4rem",
        } as CSSProperties
      }
    >
      <DashboardLayoutContent
        setSidebarWidth={(width) => setSidebarWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width)))}
        sidebarWidth={sidebarWidth}
      >
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
  sidebarWidth: number;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
  sidebarWidth,
}: DashboardLayoutContentProps) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= 240 && newWidth <= 360) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <Sidebar
        ref={sidebarRef}
        collapsible="icon"
        className="hidden md:flex border-r-0"
        disableTransition={isResizing}
      >
        <SidebarHeader className="border-b border-border/50 px-4 py-5">
          <div className="flex items-center justify-between group-data-[collapsible=icon]:justify-center w-full">
            <div className="space-y-1 group-data-[collapsible=icon]:hidden">
              <h1 className="text-2xl font-bold tracking-tight">
                Fer<span className="text-primary">Fit</span>
              </h1>
              <p className="text-xs text-muted-foreground">
                AI Fitness Platform
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="rounded-xl"
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          </div>
        </SidebarHeader>

        <SidebarContent className="px-3 py-4">
          <SidebarMenu className="space-y-2">
            {menuItems.map(item => {
              const isActive = location === item.path;
              return (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton
                    isActive={isActive}
                    onClick={() => setLocation(item.path)}
                    tooltip={item.label}
                    className={`h-11 rounded-xl transition-all duration-200 font-medium ${isActive
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "hover:bg-muted/70"}`}
                  >
                    <item.icon
                      className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                    />
                    <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Avatar className="h-9 w-9 border shrink-0">
                  <AvatarFallback className="text-xs font-medium">
                    {(user?.firstName || user?.username || "U")?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                  <p className="text-sm font-medium truncate leading-none">
                    {user?.firstName || user?.username || "-"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-1.5">
                    {user?.emailAddresses?.[0]?.emailAddress || "-"}
                  </p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() => signOut()}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="w-full">
        <main className="flex-1 p-4 md:p-6 md:pl-0 pb-24 md:pb-6">{children}</main>
      </SidebarInset>

      {/* Bottom Navigation for Mobile */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 h-16 bg-background/95 border-t border-border/50 backdrop-blur supports-[backdrop-filter]:backdrop-blur flex items-center justify-around px-2 z-50 pb-safe">
          {/* Dashboard */}
          <button
            onClick={() => setLocation("/dashboard")}
            className={`flex flex-col items-center justify-center gap-1 flex-1 h-full text-center transition-all ${
              location === "/dashboard" ? "text-accent" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutDashboard className="h-5 w-5" />
            <span className="text-[10px] font-medium tracking-tight">Dashboard</span>
          </button>

          {/* Entrenamiento */}
          <button
            onClick={() => setLocation("/entrenamiento")}
            className={`flex flex-col items-center justify-center gap-1 flex-1 h-full text-center transition-all ${
              location === "/entrenamiento" ? "text-accent" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Dumbbell className="h-5 w-5" />
            <span className="text-[10px] font-medium tracking-tight">Entrenamiento</span>
          </button>

          {/* Nutrición */}
          <button
            onClick={() => setLocation("/nutricion")}
            className={`flex flex-col items-center justify-center gap-1 flex-1 h-full text-center transition-all ${
              location === "/nutricion" ? "text-accent" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Apple className="h-5 w-5" />
            <span className="text-[10px] font-medium tracking-tight">Nutrición</span>
          </button>

          {/* Progreso */}
          <button
            onClick={() => setLocation("/progreso")}
            className={`flex flex-col items-center justify-center gap-1 flex-1 h-full text-center transition-all ${
              location === "/progreso" ? "text-accent" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <TrendingUp className="h-5 w-5" />
            <span className="text-[10px] font-medium tracking-tight">Progreso</span>
          </button>

          {/* Avatar / Cerrar Sesión */}
          <button
            onClick={() => {
              if (confirm("¿Estás seguro de que deseas cerrar sesión?")) {
                signOut();
              }
            }}
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full text-center text-muted-foreground hover:text-foreground transition-all"
          >
            <div className="w-5 h-5 rounded-full border border-border/60 overflow-hidden flex items-center justify-center bg-muted/30">
              {user?.imageUrl ? (
                <img src={user.imageUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <Avatar className="h-full w-full">
                  <AvatarFallback className="text-[10px] font-bold">
                    {(user?.firstName || user?.username || "U")?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
            <span className="text-[10px] font-medium tracking-tight">Salir</span>
          </button>
        </div>
      )}
    </>
  );
}