import * as React from "react";
import { FormattedMessage } from "react-intl";
import LoginForm from "./loginForm";
import { LocalSessionStore } from "../../business/auth";

export default function() {
    return (
        <div>
            <h1>
                <FormattedMessage id="app.login.headline" />
            </h1>
            <LoginForm sessionStore={new LocalSessionStore()} />
        </div>
    );
}
