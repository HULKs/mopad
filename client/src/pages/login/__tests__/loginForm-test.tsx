import * as React from "react";
import LoginForm, { DisconnectedLoginForm } from "../loginForm";
import { InjectedIntl, IntlProvider } from "react-intl";
import { shallowWithIntl } from "../../../__tests__/enzyme-intl-helpers";

jest.mock("../../../business/auth");

describe("LoginForm", () => {
    function changeEvent(value: string) {
        return {
            target: {
                value
            }
        };
    }

    it("uses the credentials from the form to log in", () => {
        const loginSpy = jest.fn();
        const form = shallowWithIntl(
            <DisconnectedLoginForm onLogin={loginSpy} />
        );

        const emailInput = form.find("#email");
        expect(emailInput).toHaveLength(1);
        const passwordInput = form.find("#password");
        expect(passwordInput).toHaveLength(1);

        form.find("#email").simulate("change", {}, "test@example.com");
        form.find("#password").simulate("change", {}, "p4ssw0rd!");
        form.find('button[type="submit"]').simulate("click");

        expect(loginSpy).toHaveBeenCalledWith("test@example.com", "p4ssw0rd!");
        expect(form.find(".error")).toHaveLength(0);
    });

    it("renders errors", async () => {
        const form = shallowWithIntl(
            <DisconnectedLoginForm
                doLogin={jest.fn()}
                error={{
                    message: "MY_MESSAGE"
                }}
            />
        );

        expect(form.find(".error")).toHaveLength(1);
    });
});
