import * as React from "react";
import { shallow } from "enzyme";
import { DisconnectedLoginForm } from "../loginForm";
jest.mock("../../../business/auth");
import { LocalSessionStore } from "../../../business/auth";
import { flushAllPromises } from "../../../__tests__/testutil";

describe("LoginForm", () => {
    function changeEvent(value: string) {
        return {
            target: {
                value
            }
        };
    }

    it("uses the credentials from the form to log in", () => {
        const doLogin = jest.fn().mockReturnValue(
            Promise.resolve({
                data: {
                    authenticateUser: {
                        token: "my-token",
                        id: "my-id"
                    }
                }
            })
        );

        const sessionStore = new LocalSessionStore();
        const form = shallow(
            <DisconnectedLoginForm
                sessionStore={sessionStore}
                doLogin={doLogin}
            />
        );

        const emailInput = form.find("#email");
        expect(emailInput).toHaveLength(1);
        const passwordInput = form.find("#password");
        expect(passwordInput).toHaveLength(1);

        form.find("#email").simulate("change", changeEvent("test@example.com"));
        form.find("#password").simulate("change", changeEvent("p4ssw0rd!"));
        form.find('button[type="submit"]').simulate("click");

        expect(doLogin).toHaveBeenCalledWith("test@example.com", "p4ssw0rd!");
    });

    it("handles errors during login", async () => {
        const doLogin = jest.fn().mockReturnValue(Promise.reject(new Error()));

        const sessionStore = new LocalSessionStore();
        const form = shallow(
            <DisconnectedLoginForm
                sessionStore={sessionStore}
                doLogin={doLogin}
            />
        );

        expect(
            form.findWhere(n => n.prop("id") === "app.login.error.message")
        ).toHaveLength(0);

        form.find('button[type="submit"]').simulate("click");
        await flushAllPromises();

        expect(
            form
                .update()
                .findWhere(n => n.prop("id") === "app.login.error.message")
        ).toHaveLength(1);
    });

    it("saves the session after login", async () => {
        const doLogin = jest.fn().mockReturnValue(
            Promise.resolve({
                data: {
                    authenticateUser: {
                        token: "my-token",
                        id: "my-id"
                    }
                }
            })
        );

        const sessionStore = new LocalSessionStore();
        const form = shallow(
            <DisconnectedLoginForm
                sessionStore={sessionStore}
                doLogin={doLogin}
            />
        );

        form.find('button[type="submit"]').simulate("click");
        await flushAllPromises();

        expect(sessionStore.token).toBe("my-token");
        expect(sessionStore.userId).toBe("my-id");
    });
});
