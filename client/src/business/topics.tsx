import * as React from "react";
import gql from "graphql-tag";
import graphql from "react-apollo/graphql";
import { compose } from "react-apollo";
import {
    AddTopicMutation,
    JoinAsExpertMutation,
    JoinAsNewbieMutation,
    LeaveAsExpertMutation,
    LeaveAsNewbieMutation,
    DeleteTopicMutation,
    AllTopicsQuery,
    TopicDisplayFragment
} from "../../mopad-graphql";
import { ISessionStore, LocalSessionStore } from "./auth";

const TOPIC_DISPLAY_FRAGMENT = gql`
    fragment TopicDisplay on Topic {
        id
        title
        description
        begin
        location {
            name
        }
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

const DELETE_TOPIC_MUTATION = gql`
    mutation DeleteTopic($topicId: ID!) {
        deleteTopic(id: $topicId) {
            id
        }
    }
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

const deleteTopic = graphql<DeleteTopicMutation>(DELETE_TOPIC_MUTATION, {
    props: ({ mutate, ownProps }) => ({
        ...ownProps,
        deleteTopic: (topicId: string) =>
            mutate({
                variables: { topicId },
                update: (
                    proxy,
                    { data: { deleteTopic } }: { data: DeleteTopicMutation }
                ) => {
                    // Read the data from our cache for this query.
                    const data = proxy.readQuery<AllTopicsQuery>({
                        query: ALL_TOPICS_QUERY
                    });
                    // Remove our topic from the cached topics
                    data.allTopics = data.allTopics.filter(
                        t => t.id != deleteTopic.id
                    );
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
        allTopics: data.allTopics
    })
});

export interface TopicViewModel extends TopicDisplayFragment {
    userIsExpert: boolean;
    userIsNewbie: boolean;
    canManage: boolean;
}
interface TopicProps {
    allTopics: TopicDisplayFragment[];
}
interface TopicViewModelProps {
    topics: TopicViewModel[];
}
function topicConverter<Props extends TopicViewModelProps, State>(
    Comp: new () => React.Component<Props, State>
) {
    return class ConvertedTopicComponent extends React.Component<
        Props & TopicProps,
        State
    > {
        private sessionStore: ISessionStore;
        constructor(props) {
            super(props);
            this.sessionStore = new LocalSessionStore();
            this.convertTopic = this.convertTopic.bind(this);
        }

        private convertTopic(topic: TopicDisplayFragment): TopicViewModel {
            return {
                ...topic,
                userIsExpert: topic.experts.some(
                    u => u.id == this.sessionStore.userId
                ),
                userIsNewbie: topic.newbies.some(
                    u => u.id == this.sessionStore.userId
                ),
                canManage: this.sessionStore.userIsAdmin
            };
        }

        render() {
            return (
                <Comp
                    {...this.props}
                    topics={(this.props.allTopics || []).map(this.convertTopic)}
                />
            );
        }
    };
}

export const TopicConnector = compose(
    addTopic,
    deleteTopic,
    joinTopicAsExpert,
    joinTopicAsNewbie,
    leaveTopicAsExpert,
    leaveTopicAsNewbie,
    loadTopic,
    topicConverter
);
