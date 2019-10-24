import { expect } from "chai";
import { Web } from "@pnp/sp/src/webs";
import "@pnp/sp/src/lists/web";
import "@pnp/sp/src/items/list";
import { testSettings } from "../main";

describe("Batching", () => {

    if (testSettings.enableWebTests) {

        it("Should execute batches in the expected order for a single request", () => {

            const web = Web(testSettings.sp.webUrl);

            const order: number[] = [];

            const batch = web.createBatch();

            web.inBatch(batch).get().then(_ => {
                order.push(1);
            });

            return expect(batch.execute().then(_ => {
                order.push(2);
                return order;
            })).to.eventually.be.fulfilled.and.eql([1, 2]);
        });

        it("Should execute batches in the expected order for an even number of requests", () => {

            const web = Web(testSettings.sp.webUrl);

            const order: number[] = [];

            const batch = web.createBatch();

            web.inBatch(batch)().then(_ => {
                order.push(1);
            });

            web.lists.inBatch(batch)().then(_ => {
                order.push(2);
            });

            web.lists.top(2).inBatch(batch)().then(_ => {
                order.push(3);
            });

            web.lists.select("Title").inBatch(batch)().then(_ => {
                order.push(4);
            });

            return expect(batch.execute().then(_ => {
                order.push(5);
                return order;
            })).to.eventually.be.fulfilled.and.eql([1, 2, 3, 4, 5]);
        });

        it("Should execute batches in the expected order for an odd number of requests", () => {

            const web = Web(testSettings.sp.webUrl);

            const order: number[] = [];

            const batch = web.createBatch();

            web.inBatch(batch)().then(_ => {
                order.push(1);
            });

            web.lists.inBatch(batch)().then(_ => {
                order.push(2);
            });

            web.lists.top(2).inBatch(batch)().then(_ => {
                order.push(3);
            });

            return expect(batch.execute().then(_ => {
                order.push(4);
                return order;
            })).to.eventually.be.fulfilled.and.eql([1, 2, 3, 4]);
        });

        it("Should execute batches that have internally cloned requests", () => {

            const web = Web(testSettings.sp.webUrl);

            const order: number[] = [];

            const batch = web.createBatch();

            return expect(web.lists.ensure("BatchItemAddTest").then(ler => {

                const list = ler.list;

                return list.getListItemEntityTypeFullName().then(ent => {

                    list.items.inBatch(batch).add({ Title: "Hello 1" }, ent).then(_ => order.push(1));

                    list.items.inBatch(batch).add({ Title: "Hello 2" }, ent).then(_ => order.push(2));

                    return batch.execute().then(_ => {
                        order.push(3);
                        return order;
                    });
                });
            })).to.eventually.eql([1, 2, 3]);
        });
    }
});
