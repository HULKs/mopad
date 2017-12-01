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
    LeaveAsExpertMutation,
    LeaveAsNewbieMutation,
    AllTopicsQuery,
    TopicDisplayFragment
} from "../../../mopad-graphql";
import { ApolloError, ApolloQueryResult } from "apollo-client";
import { compose } from "react-apollo";
import { ParticipationType, ParticipationChange } from "../../business/types";

interface PublicProps {}
interface HomeProps {
    error: ApolloError;
    loading: boolean;
    topics: TopicDisplayFragment[];
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
    leaveAsExpert(
        userId: string,
        topicId: string
    ): Promise<ApolloQueryResult<LeaveAsExpertMutation>>;
    leaveAsNewbie(
        userId: string,
        topicId: string
    ): Promise<ApolloQueryResult<LeaveAsNewbieMutation>>;
}
type Props = PublicProps & HomeProps;

export class Home extends React.Component<Props> {
    private sessionStore: ISessionStore;

    constructor(props: Props) {
        super(props);

        this.sessionStore = new LocalSessionStore();
        this.onTopicAdd = this.onTopicAdd.bind(this);
        this.onChangeParticipation = this.onChangeParticipation.bind(this);
    }

    public render() {
        return (
            <div className="page">
                <h1>
                    <FormattedMessage id="app.home" />
                </h1>
                <TopicList
                    topics={this.props.topics || []}
                    onChangeParticipation={this.onChangeParticipation}
                />
                <TopicAdd onTopicAdd={this.onTopicAdd} />
            </div>
        );
    }

    private onTopicAdd(title: string): void {
        this.props.addTopic(title);
    }

    private onChangeParticipation(
        topicId: string,
        type: ParticipationType,
        action: ParticipationChange
    ): void {
        switch (`${action}:${type}`) {
            case "join:expert":
                this.props.joinAsExpert(this.sessionStore.userId, topicId);
                break;
            case "join:newbie":
                this.props.joinAsNewbie(this.sessionStore.userId, topicId);
                break;
            default:
                throw new Error("invalid change of participation");
        }
    }
}

const TOPIC_DISPLAY_FRAGMENT = gql`
    fragment TopicDisplay on Topic {
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
`;

const ADD_TOPIC_MUTATION = gql`
    mutation AddTopic($title: String!, $description: String) {
        createTopic(title: $title, description: $description) {
            ...TopicDisplay
        }
    }
    ${TOPIC_DISPLAY_FRAGMENT}
`;

/* TODO: maybe use factory and define types manually */
const JOIN_AS_EXPERT_MUTATION = gql`
    mutation JoinAsExpert($userId: ID!, $topicId: ID!) {
        addToExpertParticipation(
            expertsUserId: $userId
            topicsAsExpertTopicId: $topicId
        ) {
            topicsAsExpertTopic {
                ...TopicDisplay
            }
        }
    }
    ${TOPIC_DISPLAY_FRAGMENT}
`;

const JOIN_AS_NEWBIE_MUTATION = gql`
    mutation JoinAsNewbie($userId: ID!, $topicId: ID!) {
        addToNewbieParticipation(
            newbiesUserId: $userId
            topicsAsNewbieTopicId: $topicId
        ) {
            topicsAsNewbieTopic {
                ...TopicDisplay
            }
        }
    }
    ${TOPIC_DISPLAY_FRAGMENT}
`;

const LEAVE_AS_EXPERT_MUTATION = gql`
    mutation LeaveAsExpert($userId: ID!, $topicId: ID!) {
        removeFromExpertParticipation(
            expertsUserId: $userId
            topicsAsExpertTopicId: $topicId
        ) {
            topicsAsExpertTopic {
                ...TopicDisplay
            }
        }
    }
    ${TOPIC_DISPLAY_FRAGMENT}
`;

const LEAVE_AS_NEWBIE_MUTATION = gql`
    mutation LeaveAsNewbie($userId: ID!, $topicId: ID!) {
        removeFromNewbieParticipation(
            newbiesUserId: $userId
            topicsAsNewbieTopicId: $topicId
        ) {
            topicsAsNewbieTopic {
                ...TopicDisplay
            }
        }
    }
    ${TOPIC_DISPLAY_FRAGMENT}
`;

const ALL_TOPICS_QUERY = gql`
    query AllTopics {
        allTopics {
            ...TopicDisplay
        }
    }
    ${TOPIC_DISPLAY_FRAGMENT}
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

/* TODO: maybe use factory pattern and define types manually */
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

const leaveTopicAsExpert = graphql<JoinAsExpertMutation>(
    LEAVE_AS_EXPERT_MUTATION,
    {
        props: ({ mutate, ownProps }) => ({
            ...ownProps,
            leaveAsExpert: (userId: string, topicId: string) =>
                mutate({ variables: { userId, topicId } })
        })
    }
);

const leaveTopicAsNewbie = graphql<JoinAsExpertMutation>(
    LEAVE_AS_NEWBIE_MUTATION,
    {
        props: ({ mutate, ownProps }) => ({
            ...ownProps,
            leaveAsNewbie: (userId: string, topicId: string) =>
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
    leaveTopicAsExpert,
    leaveTopicAsNewbie,
    loadTopic
)(Home);
