import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// 커스텀 글자 크기를 색상으로 오인하면 text-void/text-fg 등이 지워진다.
const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "step--1",
            "step-0",
            "step-1",
            "step-2",
            "step-3",
            "step-hero",
            "hero",
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return merge(clsx(inputs));
}
