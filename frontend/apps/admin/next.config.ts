import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin({
    requestConfig: "./src/layers/shared/i18n/request.ts",
})

export default withNextIntl({
    output: "standalone",
})
