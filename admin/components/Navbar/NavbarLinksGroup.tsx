"use client";
import { useState, useEffect } from "react";
import { Box, Collapse, Group, UnstyledButton } from "@mantine/core";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ChevronDown, LucideIcon } from "lucide-react";
import classes from "./NavbarLinksGroup.module.css";

interface LinksGroupProps {
  label: string;
  initiallyOpened?: boolean;
  links?: {
    label: string;
    link: string;
    icon: LucideIcon;
  }[];
  link?: string;
  icon: LucideIcon;
}

export function LinksGroup({
  label,
  initiallyOpened,
  links,
  link,
  icon: Icon,
}: LinksGroupProps) {
  const hasLinks = Array.isArray(links);
  const [opened, setOpened] = useState(initiallyOpened || false);
  const router = useRouter();
  const pathname = usePathname();

  // Check if the current path matches this link or any of its children
  const isLinkActive = link && pathname === link;
  const hasActiveChild =
    hasLinks && links.some((item) => pathname === item.link);

  // Auto-open the group if it contains the active link
  useEffect(() => {
    if (hasActiveChild && !opened) {
      setOpened(true);
    }
  }, [pathname, hasActiveChild]);

  const handleClick = () => {
    if (hasLinks) {
      setOpened((o) => !o);
    } else if (link) {
      router.push(link);
    }
  };

  const items = (hasLinks ? links : []).map((item) => {
    const isActive = pathname === item.link;

    return (
      <Link
        href={item.link}
        className={`${classes.link} ${isActive ? classes.linkActive : ""}`}
        key={item.label}
      >
        <Group gap="sm">
          {item.icon && <item.icon size={18} className={classes.icon} />}
          <span>{item.label}</span>
        </Group>
      </Link>
    );
  });

  return (
    <>
      <UnstyledButton
        onClick={handleClick}
        className={`${classes.control} ${
          hasLinks ||
          (isLinkActive || hasActiveChild ? classes.controlActive : "")
        }`}
      >
        <Group justify="space-between" gap={0}>
          <Group gap="sm">
            {Icon && <Icon size={18} className={classes.icon} />}
            <span>{label}</span>
          </Group>
          {hasLinks && (
            <ChevronDown
              size={16}
              className={`${classes.chevron} ${classes.icon}`}
              style={{
                transform: opened ? `rotate(180deg)` : "none",
              }}
            />
          )}
        </Group>
      </UnstyledButton>
      {hasLinks ? <Collapse in={opened}>{items}</Collapse> : null}
    </>
  );
}
