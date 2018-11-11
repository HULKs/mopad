import { AuthenticationLink, ISessionStore, LocalSessionStore } from "../auth";
import { Operation } from "apollo-link";

describe("auth", () => {
    describe("AuthenticationLink", () => {
        const MockOperation = jest.fn<Operation>(spy => ({
            setContext: spy
        }));

        it("decorates an authorization header to the request", () => {
            const tokenStore = new (jest.fn<ISessionStore>(() => ({
                token: "MY_TOKEN"
            })))();
            const link = new AuthenticationLink(tokenStore);

            const setContext = jest.fn();
            const operation = new MockOperation(setContext);
            const forward = jest.fn();
            link.request(operation, forward);

            expect(setContext).toHaveBeenCalledTimes(1);
            const cb = setContext.mock.calls[0][0];
            const result = cb({
                headers: {
                    test: "header"
                }
            });

            expect(result.headers).toMatchObject({
                test: "header",
                authorization: "Bearer MY_TOKEN"
            });
        });
    });

    describe("LocalSessionStore", () => {
        beforeAll(() => {
            jest.spyOn(localStorage, "getItem").mockImplementation(jest.fn());
            jest.spyOn(localStorage, "setItem").mockImplementation(jest.fn());
        });

        it("stores tokens in the local storage", () => {
            const storage = new LocalSessionStore();
            storage.token = "TOKEN";

            expect(localStorage.setItem).toHaveBeenCalledWith("token", "TOKEN");

            const token = storage.token;
            expect(localStorage.getItem).toHaveBeenCalled();
        });

        it("stores the userId in the local storage", () => {
            const storage = new LocalSessionStore();
            storage.userId = "USER_ID";

            expect(localStorage.setItem).toHaveBeenCalledWith("userId", "USER_ID");

            const uid = storage.userId;
            expect(localStorage.getItem).toHaveBeenCalled();
        });
    });
});
