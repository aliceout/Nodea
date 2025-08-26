// src/components/common/UserAvatar.jsx
import Avatar from "boring-avatars";

export default function UserAvatar({
  seed, // string stable (id ou username)
  size = 32,
  className = "",
  variant = "bauhaus", // "beam" | "marble" | "pixel" | "sunset" | "ring" | "bauhaus"
}) {
  return (
    <Avatar
      size={size}
      name={seed}
      variant={variant}
      colors={[
        "#90b6a2", // sage
        "#d8c7e4", // lavender
        "#f4d8d9", // blush
        "#a9d6e5", // sky
        "#2b2d2f", // slate
      ]}
      square={false}
      className={className}
    />
  );
}
