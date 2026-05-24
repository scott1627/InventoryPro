/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        serverActions: {
            bodySizeLimit: '1gb',
        },
    },
};

module.exports = nextConfig;
