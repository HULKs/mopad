import * as React from "react";
import { FormattedMessage, injectIntl } from "react-intl";
import gql from "graphql-tag";
import graphql from "react-apollo/graphql";
import TopicList from "./topicList";
import TopicAdd from "./topicAdd";
import { AddTopicMutation, AllTopicsQuery } from "../../../mopad-graphql";
import { ApolloError, ApolloQueryResult } from "apollo-client";
import { compose } from "react-apollo";

interface PublicProps {}
interface HomeProps {
    error: ApolloError;
    loading: boolean;
    topics: AllTopicsQuery["allTopics"];
    addTopic(
        title: string,
        description?: string
    ): Promise<ApolloQueryResult<AddTopicMutation>>;
}
type Props = PublicProps & HomeProps;

export class Home extends React.Component<Props> {
    constructor(props: Props) {
        super(props);

        this.onTopicAdd = this.onTopicAdd.bind(this);
        this.onJoin = this.onJoin.bind(this);
    }

    public render() {
        return (
            <div className="page">
                <h1>
                    <FormattedMessage id="app.home" />
                </h1>
                <TopicList topics={this.props.topics || []} onJoin={this.onJoin} />
                <TopicAdd onTopicAdd={this.onTopicAdd} />
            </div>
        );
    }

    private onTopicAdd(title: string): void {
        this.props.addTopic(title);
    }

    private onJoin(topicId: string, type: 'expert'|'newbie'): void {
        console.log('join', topicId, type);
    }
}

const ADD_TOPIC_MUTATION = gql`
    mutation AddTopic($title: String!, $description: String) {
        createTopic(title: $title, description: $description) {
            id
            title
            description
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
            mutate({
                variables: { title, description },
                update: (proxy, { data: { createTopic } }) => {
                    // Read the data from our cache for this query.
                    const data = proxy.readQuery<AllTopicsQuery>({ query: ALL_TOPICS_QUERY });
                    // Add our todo from the mutation to the end.
                    data.allTopics.push(createTopic);
                    // Write our data back to the cache.
                    proxy.writeQuery({ query: ALL_TOPICS_QUERY, data });
                }
            })
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
