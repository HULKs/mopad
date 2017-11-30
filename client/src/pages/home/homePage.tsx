import * as React from "react";
import { FormattedMessage, injectIntl } from "react-intl";
import gql from "graphql-tag";
import graphql from "react-apollo/graphql";
import TopicList from "./topicList";
import TopicAdd from "./topicAdd";
import { AddTopicMutation, AllTopicsQuery } from "../../../mopad-graphql";
import { ApolloError } from "apollo-client";
import { compose } from "react-apollo";

interface PublicProps {}
interface HomeProps {
    error: ApolloError;
    loading: boolean;
    topics: AllTopicsQuery["allTopics"];
}
type Props = PublicProps & HomeProps;

export class Home extends React.Component<Props> {
    constructor(props: Props) {
        super(props);

        this.onTopicAdd = this.onTopicAdd.bind(this);
    }

    public render() {
        return (
            <div style={{ padding: "2em" }}>
                <h1>
                    <FormattedMessage id="app.home" />
                </h1>
                <TopicList topics={this.props.topics || []} />
                <TopicAdd onTopicAdd={this.onTopicAdd} />
            </div>
        );
    }

    private onTopicAdd(title: string): void {
        console.info(title);
    }
}

const ADD_TOPIC_MUTATION = gql`
    mutation AddTopic($title: String!, $description: String) {
        createTopic(title: $title, description: $description) {
            id
        }
    }
`;

const ALL_TOPICS_QUERY = gql`
    query AllTopics {
        allTopics {
            id
            title
            description
        }
    }
`;

const addTopic = graphql<AddTopicMutation>(ADD_TOPIC_MUTATION, {
    props: ({ mutate, ownProps }) => ({
        ...ownProps,
        addTopic: (title: string, description?: string) =>
            mutate({ variables: { title, description } })
    })
});

const loadTopic = graphql<AllTopicsQuery>(ALL_TOPICS_QUERY, {
    props: ({ data, ownProps }) => ({
        ...ownProps,
        error: data.error,
        loading: data.loading,
        topics: data.allTopics
    })
});

export default compose(addTopic, loadTopic)(Home);
