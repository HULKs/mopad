import { fromEvent, FunctionEvent } from "graphcool-lib";
import { GraphQLClient } from "graphql-request";
import * as bcrypt from "bcryptjs";
import * as validator from "validator";

interface User {
    id: string;
}

interface EventData {
    email: string;
    password: string;
    name: string;
    teamId: string;
}

const SALT_ROUNDS = 10;

export default async (event: FunctionEvent<EventData>) => {
    try {
        const graphcool = fromEvent(event);
        const api = graphcool.api("simple/v1");

        const { name, email, password, teamId } = event.data;

        if (!validator.isEmail(email)) {
            return { error: "Not a valid email" };
        }

        // check if user exists already
        const userExists: boolean = await getUser(api, email).then(r => r.User !== null);
        if (userExists) {
            return { error: "EMAIL_IN_USE" };
        }

        // create password hash
        const hash = await bcrypt.hash(password, SALT_ROUNDS);

        // create new user
        const userId = await createGraphcoolUser(api, name, email, hash, teamId, false);

        // generate node token for new User node
        const token = await graphcool.generateNodeToken(userId, "User");

        return { data: { id: userId, token } };
    } catch (e) {
        return { error: "UNEXPECTED_ERROR" + e.message };
    }
};

async function getUser(api: GraphQLClient, email: string): Promise<{ User: User }> {
    const query = `
    query getUser($email: String!) {
      User(email: $email) {
        id
      }
    }
  `;

    const variables = {
        email
    };

    return api.request<{ User: User }>(query, variables);
}

async function createGraphcoolUser(
    api: GraphQLClient,
    name: string,
    email: string,
    password: string,
    teamId: string,
    isAdmin: boolean
): Promise<string> {
    const mutation = `
    mutation createGraphcoolUser($name: String!, $email: String!, $password: String!, $teamId: ID, $isAdmin: Boolean!) {
      createUser(
        email: $email,
        password: $password,
        name: $name,
        teamId: $teamId,
        isAdmin: $isAdmin
      ) {
        id
      }
    }
  `;

    const variables = {
        name,
        email,
        password,
        teamId,
        isAdmin
    };

    return api.request<{ createUser: User }>(mutation, variables).then(r => r.createUser.id);
}
