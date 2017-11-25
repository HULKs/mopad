import { ApolloLink, NextLink, Operation } from "apollo-link";

export class AuthenticationLink extends ApolloLink {
    constructor(private tokenStore: ISessionStore) {
        super();
    }

    public request(operation: Operation, forward?: NextLink) {
        operation.setContext(({ headers }) => ({
            headers: {
                ...headers,
                authorization: `Bearer ${this.tokenStore.token}`
            }
        }));

        return forward(operation);
    }
}

export interface ISessionStore {
    token: string;
    userId: string;
}

export class LocalSessionStore implements ISessionStore {
    public get token(): string {
        return localStorage.getItem("token");
    }

    public set token(value: string) {
        localStorage.setItem("token", value);
    }

    public get userId(): string {
        return localStorage.getItem("userId");
    }

    public set userId(value: string) {
        localStorage.setItem("userId", value);
    }
}
