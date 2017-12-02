import * as React from "react";
import { ISessionStore, LocalSessionStore } from "./auth";

export interface User {
    id: string;
    isAdmin: boolean;
}

interface InjectedProps {
    user: User;
}

export function withUser<Props>(
    WrappedComponent:
        | React.ComponentClass<Props & InjectedProps>
        | React.StatelessComponent<Props & InjectedProps>
) {
    return class extends React.Component<Props> {
        private sessionStore: ISessionStore;
        constructor(props) {
            super(props);
            this.sessionStore = new LocalSessionStore();
        }
        render() {
            const user: User = {
                id: this.sessionStore.userId,
                isAdmin: this.sessionStore.userIsAdmin
            };
            return <WrappedComponent user={user} {...this.props} />;
        }
    };
}
