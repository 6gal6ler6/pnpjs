var settings = {

    testing: {
        enableWebTests: true,
        sp: {
            id: "{ client id }",
            secret: "{ client secret }",
            url: "{ site collection url }",
            notificationUrl: "{ notification url }",
            sitedesigns: {
                testuser: "{ valid username i.e. contoso@contoso.onmicrosoft.com }",
            },
            subscriptions: {
                notificationUrl: "{ A remote notification URL for the webhook }",
            }
        },
        graph: {
            tenant: "{tenant.onmicrosoft.com}",
            id: "{your app id}",
            secret: "{your secret}"
        },
    }
}

module.exports = settings;
