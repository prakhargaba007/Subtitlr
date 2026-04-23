"use client";

import { Group, ScrollArea, Drawer, Button } from "@mantine/core";
import { LinksGroup } from "./NavbarLinksGroup";
// import { UserButton } from "./UserButton";
import classes from "./AdminNavbar.module.css";
import Image from "next/image";
import Link from "next/link";
import {
  LayoutDashboard,
  School,
  GraduationCap,
  Bell,
  Package,
  Users,
  Receipt,
  ClipboardList,
  Clock,
  CheckCircle,
  XCircle,
  CircleDollarSign,
  Menu,
  FolderKanban,
  Video,
  Film,
  Tag,
  BookOpen,
  FileText,
  Layers,
  UserCircle,
  MessageSquare,
  FolderOpen,
  Settings,
  LogOut,
  User,
  UserCog,
  Briefcase,
  BookCheck,
  PenTool,
  Award,
  BarChart,
  Calendar,
  HelpCircle,
  Images,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useViewportSize } from "@mantine/hooks";
import { IconLogout } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { assets } from "@/assets/assets";

// Define the icon type
type IconName =
  | "dashboard"
  | "school"
  | "graduation"
  | "bell"
  | "package"
  | "users"
  | "receipt"
  | "clipboard"
  | "clock"
  | "checkCircle"
  | "xCircle"
  | "menu"
  | "folder"
  | "dollarSign"
  | "video"
  | "post"
  | "images"
  | "film"
  | "tag"
  | "book"
  | "fileText"
  | "layers"
  | "userCircle"
  | "messageSquare"
  | "folderOpen"
  | "settings"
  | "logOut"
  | "user"
  | "userCog"
  | "briefcase"
  | "bookCheck"
  | "penTool"
  | "award"
  | "barChart"
  | "calendar"
  | "helpCircle"
  | "pricing";

// Map icon names to components
const IconMap = {
  dashboard: LayoutDashboard,
  school: School,
  graduation: GraduationCap,
  bell: Bell,
  package: Package,
  users: Users,
  receipt: Receipt,
  clipboard: ClipboardList,
  clock: Clock,
  checkCircle: CheckCircle,
  xCircle: XCircle,
  menu: Menu,
  folder: FolderKanban,
  dollarSign: CircleDollarSign,
  video: Video,
  post: Images,
  images: Images,
  film: Film,
  tag: Tag,
  book: BookOpen,
  fileText: FileText,
  layers: Layers,
  userCircle: UserCircle,
  messageSquare: MessageSquare,
  folderOpen: FolderOpen,
  settings: Settings,
  logOut: LogOut,
  user: User,
  userCog: UserCog,
  briefcase: Briefcase,
  bookCheck: BookCheck,
  penTool: PenTool,
  award: Award,
  barChart: BarChart,
  calendar: Calendar,
  helpCircle: HelpCircle,
  pricing: CircleDollarSign,
};

interface NavItem {
  label: string;
  link?: string;
  iconName: IconName;
  accessTo: ("admin" | "sub-admin")[];
  accessKey?: string; // Key used for permission checking
  initiallyOpened?: boolean;
  links?: {
    label: string;
    link: string;
    iconName: IconName;
    accessTo?: ("admin" | "sub-admin")[];
    accessKey?: string;
  }[];
}

const mockdata: NavItem[] = [
  {
    label: "Dashboard",
    link: "/dashboard",
    iconName: "dashboard",
    accessTo: ["admin", "sub-admin"],
    accessKey: "dashboard",
  },
  // {
  //   label: "Categories",
  //   iconName: "folderOpen",
  //   link: "/dashboard/categories/all-categories",
  //   accessTo: ["admin", "sub-admin"],
  //   accessKey: "categories",
  // },
  {
    label: "Tags",
    iconName: "tag",
    link: "/dashboard/tags/all-tags",
    accessTo: ["admin", "sub-admin"],
    accessKey: "tags",
  },
  {
    label: "Profiles",
    iconName: "userCircle",
    accessTo: ["admin"],
    accessKey: "profiles",
    link: "/dashboard/profiles/all-profiles",

  },
  // {
  //   label: "Posts",
  //   iconName: "post",
  //   link: "/dashboard/posts",
  //   accessTo: ["admin", "sub-admin"],
  //   accessKey: "posts",
  // },
  {
    label: "Files",
    iconName: "fileText",
    link: "/dashboard/files",
    accessTo: ["admin", "sub-admin"],
    accessKey: "files",
  },
  {
    label: "Pricing Catalog",
    iconName: "pricing",
    link: "/dashboard/billing/pricing-catalog",
    accessTo: ["admin"],
    accessKey: "pricing-catalog",
  },
  // {
  //   label: "Image Orders",
  //   iconName: "images",
  //   link: "/dashboard/image-orders",
  //   accessTo: ["admin"],
  //   accessKey: "image-orders",
  // },
];

interface NavbarNestedProps {
  opened: boolean;
  onClose: () => void;
}

export default function NavbarNested({ opened, onClose }: NavbarNestedProps) {
  const [userRole, setUserRole] = useState<string>("");
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;
  const { width } = useViewportSize();
  const router = useRouter();

  useEffect(() => {
    const role = localStorage.getItem("userRole");
    const userData = localStorage.getItem("userData");

    if (role) {
      setUserRole(role);
    }

    if (userData) {
      try {
        const parsedUserData = JSON.parse(userData);
        setUserPermissions(parsedUserData.accessPermissions || []);
      } catch (error) {
        console.error("Error parsing user data:", error);
      }
    }
  }, []);

  const hasAccess = (accessTo?: string[], accessKey?: string) => {
    if (!accessTo) return true;

    // Full admin has access to everything
    if (userRole === "admin") return true;

    // Check if role is in accessTo array
    if (!accessTo.includes(userRole)) return false;

    // For sub-admin, check specific permissions
    if (userRole === "sub-admin" && accessKey) {
      return userPermissions.includes(accessKey);
    }

    return true;
  };

  const filteredMockData = mockdata.filter((item) => {
    // Check if user has access to the main item
    if (!hasAccess(item.accessTo, item.accessKey)) return false;

    // If item has sub-links, filter those based on access
    if (item.links) {
      item.links = item.links.filter((link) =>
        hasAccess(link.accessTo, link.accessKey)
      );
      // Only include items that have accessible sub-links
      return item.links.length > 0;
    }

    return true;
  });

  const links = filteredMockData.map((item) => (
    <LinksGroup
      {...item}
      key={item.label}
      icon={IconMap[item.iconName]}
      links={item.links?.map((link) => ({
        ...link,
        icon: IconMap[link.iconName],
      }))}
    />
  ));

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userRole");
    localStorage.removeItem("userData");
    router.push("/");
  };

  const navbarContent = (
    <nav className={`${classes.navbar} flex flex-col h-full justify-between`}>
      <div>
        {width > 700 && (
          <div className={classes.header}>
            <Link href="/dashboard">
              <div className="flex items-center gap-2">
                <Image
                  src={assets.gharwaleLogoFinal}
                  alt="GharWale Logo"
                  className={classes.logo}
                  width={100}
                  height={100}
                  priority
                />
                <span className="text-2xl font-bold">Kili Labs</span>
              </div>
            </Link>
          </div>
        )}

        <ScrollArea h={500} scrollbars="y" className={classes.links}>
          <div className={classes.linksInner}>{links}</div>
        </ScrollArea>
      </div>
      <div className={classes.footer}>
        <Button
          variant="subtle"
          color="red"
          fullWidth
          onClick={handleLogout}
          className={classes.logoutButton}
        >
          <IconLogout />
          <span>Logout</span>
        </Button>
        {/* <Link href={`/dashboard/profile`}>
          <UserButton />
        </Link> */}
      </div>
    </nav>
  );

  return (
    <>
      {/* Desktop Navbar */}
      <div className={classes.desktopNav}>{navbarContent}</div>

      {/* Mobile Drawer */}
      <Drawer
        opened={opened}
        onClose={onClose}
        size="90%"
        className={classes.mobileNav}
        withCloseButton={true}
        position="left"
      >
        {navbarContent}
      </Drawer>
    </>
  );
}
