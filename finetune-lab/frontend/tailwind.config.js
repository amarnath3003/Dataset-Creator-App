/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                neu: {
                    base: '#212529',
                    dark: '#1a1d21',
                    text: '#e0e0e0',
                    dim: '#8a8f98',
                    accent: '#ff6b00',  /* Warm Orange */
                    warning: '#ffb300'
                }
            },
            borderRadius: {
                'xl': '20px',
                '2xl': '30px'
            }
        },
    },
    plugins: [],
}
