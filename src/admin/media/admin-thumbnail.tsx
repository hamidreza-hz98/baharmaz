"use client";
import { useState } from "react";
import Image from "next/image";
import ImageNotSupportedOutlinedIcon from "@mui/icons-material/ImageNotSupportedOutlined";
import { Box } from "@mui/material";

export function AdminThumbnail({
  id,
  name,
  size = 48,
}: {
  id?: string | null;
  name: string;
  size?: number;
}) {
  const [failedId, setFailedId] = useState<string | null>(null);
  return (
    <Box
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: 1,
        overflow: "hidden",
        display: "grid",
        placeItems: "center",
        bgcolor: "#f4e9e1",
        color: "text.secondary",
      }}
    >
      {id && failedId !== id ? (
        <Image
          unoptimized
          src={`/api/admin/media/${id}`}
          width={size}
          height={size}
          alt={`تصویر ${name}`}
          onError={() => setFailedId(id)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <ImageNotSupportedOutlinedIcon
          aria-label={`تصویر ${name} در دسترس نیست`}
          fontSize="small"
        />
      )}
    </Box>
  );
}
