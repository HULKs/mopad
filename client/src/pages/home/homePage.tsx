import * as React from "react";
import { FormattedMessage, injectIntl } from "react-intl";
import gql from "graphql-tag";
import graphql from "react-apollo/graphql";
import TopicList from "./topicList";
import TopicAdd from "./topicAdd";
import { ISessionStore, LocalSessionStore } from "../../business/auth";
import {
    AddTopicMutation,
    JoinAsExpertMutation,
    JoinAsNewbieMutation,
    AllTopicsQuery
} from "../../../mopad-graphql";
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
    joinAsExpert(
        userId: string,
        topicId: string
    ): Promise<ApolloQueryResult<JoinAsExpertMutation>>;
    joinAsNewbie(
        userId: string,
        topicId: string
    ): Promise<ApolloQueryResult<JoinAsNewbieMutation>>;
}
type Props = PublicProps & HomeProps;

export class Home extends React.Component<Props> {
    private sessionStore: ISessionStore;

    constructor(props: Props) {
        super(props);

        this.sessionStore = new LocalSessionStore();
        this.onTopicAdd = this.onTopicAdd.bind(this);
        this.onJoin = this.onJoin.bind(this);
    }

    public render() {
        return (
            <div className="page">
                <h1>
                    <FormattedMessage id="app.home" />
                </h1>
                <TopicList
                    topics={this.props.topics || []}
                    onJoin={this.onJoin}
                />
                <TopicAdd onTopicAdd={this.onTopicAdd} />
            </div>
        );
    }

    private onTopicAdd(title: string): void {
        this.props.addTopic(title);
    }

    private onJoin(topicId: string, type: "expert" | "newbie"): void {
        console.log("join", type, this.sessionStore.userId, topicId);
        if (type == "expert") {
            this.props.joinAsExpert(this.sessionStore.userId, topicId);
        }
    }
}

const ADD_TOPIC_MUTATION = gql`
    mutation AddTopic($title: String!, $description: String) {
        createTopic(title: $title, description: $description) {
            id
            title
            description
            experts {
                id
                name
            }
            newbies {
                id
                name
            }
        }
    }
`;

const JOIN_AS_EXPERT_MUTATION = gql`
    mutation JoinAsExpert($userId: ID!, $topicId: ID!) {
        addToExpertParticipation(
            expertsUserId: $userId
            topicsAsExpertTopicId: $topicId
        ) {
            topicsAsExpertTopic {
                id
                title
                description
                experts {
                    id
                    name
                }
                newbies {
                    id
                    name
                }
            }
        }
    }
`;

const JOIN_AS_NEWBIE_MUTATION = gql`
    mutation JoinAsNewbie($userId: ID!, $topicId: ID!) {
        addToNewbieParticipation(
            newbiesUserId: $userId
            topicsAsNewbieTopicId: $topicId
        ) {
            topicsAsNewbieTopic {
                id
                title
                description
                experts {
                    id
                    name
                }
                newbies {
                    id
                    name
                }
            }
        }
    }
`;

const ALL_TOPICS_QUERY = gql`
    query AllTopics {
        allTopics {
            id
            title
            description
            experts {
                id
                name
            }
            newbies {
                id
                name
            }
        }
    }
`;

const addTopic = graphql<AddTopicMutation>(ADD_TOPIC_MUTATION, {
    props: ({ mutate, ownProps }) => ({
        ...ownProps,
        addTopic: (title: string, description?: string) =>
            mutate({
                variables: { title, description },
                update: (
                    proxy,
                    { data: { createTopic } }: { data: AddTopicMutation }
                ) => {
                    // Read the data from our cache for this query.
                    const data = proxy.readQuery<AllTopicsQuery>({
                        query: ALL_TOPICS_QUERY
                    });
                    // Add our todo from the mutation to the end.
                    data.allTopics.push(createTopic);
                    // Write our data back to the cache.
                    proxy.writeQuery({ query: ALL_TOPICS_QUERY, data });
                }
            })
    })
});

const joinTopicAsExpert = graphql<JoinAsExpertMutation>(
    JOIN_AS_EXPERT_MUTATION,
    {
        props: ({ mutate, ownProps }) => ({
            ...ownProps,
            joinAsExpert: (userId: string, topicId: string) =>
                mutate({ variables: { userId, topicId } })
        })
    }
);

const joinTopicAsNewbie = graphql<JoinAsExpertMutation>(
    JOIN_AS_NEWBIE_MUTATION,
    {
        props: ({ mutate, ownProps }) => ({
            ...ownProps,
            joinAsNewbie: (userId: string, topicId: string) =>
                mutate({ variables: { userId, topicId } })
        })
    }
);

const loadTopic = graphql<AllTopicsQuery>(ALL_TOPICS_QUERY, {
    props: ({ data, ownProps }) => ({
        ...ownProps,
        error: data.error,
        loading: data.loading,
        topics: data.allTopics
    })
});

export default compose(
    addTopic,
    joinTopicAsExpert,
    joinTopicAsNewbie,
    loadTopic
)(Home);
