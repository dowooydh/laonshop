/** LAON SHOP Tailwind 테마 preset (라온페이 공용 테마에서 이관) */
/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6ff",
          100: "#d9eaff",
          200: "#bcdbff",
          300: "#8ec4ff",
          400: "#59a3ff",
          500: "#3380ff",
          600: "#1b60f5",
          700: "#144be1",
          800: "#173db6",
          900: "#19388f",
          950: "#142357",
        },
      },
      fontFamily: {
        sans: [
          "Pretendard Variable",
          "Pretendard",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "Apple SD Gothic Neo",
          "Segoe UI",
          "sans-serif",
        ],
      },
      keyframes: {
        "slide-down": {
          from: { transform: "translateY(-16px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        "slide-down": "slide-down 0.25s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
      },
    },
  },
};
