import React from "react";
import { Badge, Group, Text, Box } from "@mantine/core";

interface BadgeIconProps {
  icon?: string;
  name: string;
  level: string;
  category: string;
  size?: "sm" | "md" | "lg";
  showLabels?: boolean;
}

const BadgeIcon: React.FC<BadgeIconProps> = ({
  icon = "🏆",
  name,
  level,
  category,
  size = "md",
  showLabels = true,
}) => {
  const getLevelColor = (level: string) => {
    switch (level) {
      case "Bronze": return "orange";
      case "Silver": return "gray";
      case "Gold": return "yellow";
      case "Diamond": return "blue";
      default: return "gray";
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "video_watch": return "blue";
      case "game_play": return "green";
      case "quiz_answer": return "purple";
      case "app_watchtime": return "cyan";
      case "top_player": return "red";
      case "xp_milestone": return "teal";
      default: return "gray";
    }
  };

  const getIconSize = () => {
    switch (size) {
      case "sm": return "1.5rem";
      case "md": return "2rem";
      case "lg": return "3rem";
      default: return "2rem";
    }
  };

  const getTextSize = () => {
    switch (size) {
      case "sm": return "xs";
      case "md": return "sm";
      case "lg": return "md";
      default: return "sm";
    }
  };

  return (
    <Group gap="xs">
      <Text size={getIconSize()}>{icon}</Text>
      {showLabels && (
        <Box>
          <Text size={getTextSize()} fw={500}>
            {name}
          </Text>
          <Group gap="xs">
            <Badge color={getCategoryColor(category)} size={size === "sm" ? "xs" : "sm"}>
              {category.replace("_", " ")}
            </Badge>
            <Badge color={getLevelColor(level)} size={size === "sm" ? "xs" : "sm"}>
              {level}
            </Badge>
          </Group>
        </Box>
      )}
    </Group>
  );
};

export default BadgeIcon;
