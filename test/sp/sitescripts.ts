
import { getRandomString } from "@pnp/common";
import { expect } from "chai";
import { sp } from "@pnp/sp";
import "@pnp/sp/src/site-scripts";
import { testSettings } from "../main";

describe("SiteScripts", function () {

    const defaultScriptSchema = {
        "$schema": "schema.json",
        "actions": [
            {
                "verb": "applyTheme",
                "themeName": "Dummy Theme"
            }
        ],
        "bindata": {},
        "version": 1
    };

    if (testSettings.enableWebTests) {

        const createdSiteScriptIds: string[] = [];

        it("creates a site script", function () {

            const title = `Test_create_sitescript_${getRandomString(8)}`;
            const description = `${getRandomString(100)}`;
            const p = sp.siteScripts.createSiteScript(title, description, defaultScriptSchema)
                .then(ss => createdSiteScriptIds.push(ss.Id));

            return expect(p, `site script '${title}' should've been created`).to.eventually.be.fulfilled;
        });

        // TODO: this test is supposed to succeed in the future #313
        it("fails to create a site script with a single-quote in the title argument", function () {

            const title = `Test_create_sitescript_${getRandomString(8)}'`;
            const description = `${getRandomString(100)}`;
            const p = sp.siteScripts.createSiteScript(title, description, defaultScriptSchema)
                .then(ss => createdSiteScriptIds.push(ss.Id));

            return expect(p, `site script '${title}' should not have been created`).to.eventually.be.rejected;
        });

        it("fails to create a site script with no actions in the schema", function () {

            const schema = {
                "$schema": "schema.json",
                "actions": [],
                "bindata": {},
                "version": 1
            };

            const title = `Test_create_sitescript_no_actions_${getRandomString(8)}`;
            const description = `${getRandomString(100)}`;

            return expect(sp.siteScripts.createSiteScript(title, description, schema),
                `site script '${title}' should not have been created`).to.eventually.be.rejected;
        });

        it("deletes a site script", async function () {

            const title = `Test_create_sitescript_to_be_deleted_${getRandomString(8)}`;
            const description = `${getRandomString(100)}`;
            const ss = await sp.siteScripts.createSiteScript(title, description, defaultScriptSchema);

            return expect(sp.siteScripts.deleteSiteScript(ss.Id),
                `site script '${title}' should've been deleted`).to.eventually.be.fulfilled;
        });

        it("fails to delete a site script with non-existing id", function () {

            return expect(sp.siteScripts.deleteSiteScript(null),
                `site script should NOT have been deleted`).to.eventually.be.rejected;
        });

        it("gets the site script metadata", async function () {

            const title = `Test_get_metadata_sitescript${getRandomString(8)}`;
            const description = `${getRandomString(100)}`;
            const ss = await sp.siteScripts.createSiteScript(title, description, defaultScriptSchema);

            createdSiteScriptIds.push(ss.Id);

            return expect(sp.siteScripts.getSiteScriptMetadata(ss.Id),
                `metadata of site script '${title}' should have been retrieved`).to.eventually.be.fulfilled;
        });


        it("updates a site script", async function () {

            const title = `Test_to_update_sitescript_${getRandomString(8)}`;
            const description = `${getRandomString(100)}`;
            const ss = await sp.siteScripts.createSiteScript(title, description, defaultScriptSchema);

            createdSiteScriptIds.push(ss.Id);

            const updatedTitle = `Test_updated_title_sitescript_${getRandomString(8)}`;

            const updatedScriptSchema = {
                "$schema": "schema.json",
                "actions": [
                    {
                        "verb": "applyTheme",
                        "themeName": "Dummy Theme 2"
                    }
                ],
                "bindata": {},
                "version": 2
            };

            return expect(sp.siteScripts.updateSiteScript({
                Id: ss.Id,
                Title: updatedTitle
            }, updatedScriptSchema), `site script '${title}' should've been updated`).to.eventually.be.fulfilled;
        });

        it("gets all the site scripts", async function () {

            return expect(sp.siteScripts.getSiteScripts(),
                `all the site scripts should've been fetched`).to.eventually.be.fulfilled;
        });

        after(() => {

            return Promise.all(createdSiteScriptIds.map((sdId) => {
                return sp.siteScripts.deleteSiteScript(sdId);
            }));
        });
    }
});
