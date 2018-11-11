import * as React from "react";
import { ISessionStore } from "./auth";
import { RouteProps, Redirect, Route } from "react-router";

export interface PrivateRouteProps {
    sessionStore: ISessionStore;
}

export function PrivateRoute({ sessionStore, component, ...rest }: PrivateRouteProps & RouteProps) {
    const Comp = component;
    return (
        <Route
            {...rest}
            render={props =>
                sessionStore.token ? <Comp {...props} /> : <Redirect to={{ pathname: "/login" }} />
            }
        />
    );
}
