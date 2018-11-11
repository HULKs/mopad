import * as React from "react";
import gql from "graphql-tag";
import graphql from "react-apollo/graphql";
import { compose } from "react-apollo";
import {
    AddTopicMutation,
    UpdateTopicMutation,
    JoinAsExpertMutation,
    JoinAsNewbieMutation,
    LeaveAsExpertMutation,
    LeaveAsNewbieMutation,
    DeleteTopicMutation,
    AllTopicsQuery,
    TopicDisplayFragment
} from "../../mopad-graphql";
import { withUser, User } from "./withUser";
import * as Moment from "moment";

export interface TopicViewModel extends TopicDisplayFragment {
    userIsExpert: boolean;
    userIsNewbie: boolean;
    canManage: boolean;
}

export interface TopicUpdate {
    id: string;
    title: string;
    description: string | null;
    isTalk: boolean;
    begin: Date | null;
    locationId: string | null;
}

const TOPIC_DISPLAY_FRAGMENT = gql`
    fragment TopicDisplay on Topic {
        id
        title
        description
        isTalk
        begin
        location {
            id
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
        createTopic(title: $title, description: $description, isTalk: false) {
            ...TopicDisplay
        }
    }
    ${TOPIC_DISPLAY_FRAGMENT}
`;

const UPDATE_TOPIC_MUTATION = gql`
    mutation UpdateTopic(
        $id: ID!
        $title: String!
        $description: String
        $isTalk: Boolean!
        $begin: DateTime
        $locationId: ID
    ) {
        updateTopic(
            id: $id
            title: $title
            description: $description
            isTalk: $isTalk
            begin: $begin
            locationId: $locationId
        ) {
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
        addToExpertParticipation(expertsUserId: $userId, topicsAsExpertTopicId: $topicId) {
            topicsAsExpertTopic {
                ...TopicDisplay
            }
        }
    }
    ${TOPIC_DISPLAY_FRAGMENT}
`;

const JOIN_AS_NEWBIE_MUTATION = gql`
    mutation JoinAsNewbie($userId: ID!, $topicId: ID!) {
        addToNewbieParticipation(newbiesUserId: $userId, topicsAsNewbieTopicId: $topicId) {
            topicsAsNewbieTopic {
                ...TopicDisplay
            }
        }
    }
    ${TOPIC_DISPLAY_FRAGMENT}
`;

const LEAVE_AS_EXPERT_MUTATION = gql`
    mutation LeaveAsExpert($userId: ID!, $topicId: ID!) {
        removeFromExpertParticipation(expertsUserId: $userId, topicsAsExpertTopicId: $topicId) {
            topicsAsExpertTopic {
                ...TopicDisplay
            }
        }
    }
    ${TOPIC_DISPLAY_FRAGMENT}
`;

const LEAVE_AS_NEWBIE_MUTATION = gql`
    mutation LeaveAsNewbie($userId: ID!, $topicId: ID!) {
        removeFromNewbieParticipation(newbiesUserId: $userId, topicsAsNewbieTopicId: $topicId) {
            topicsAsNewbieTopic {
                ...TopicDisplay
            }
        }
    }
    ${TOPIC_DISPLAY_FRAGMENT}
`;

const ALL_TOPICS_QUERY = gql`
    query AllTopics {
        allTopics(orderBy: begin_ASC) {
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
                update: (proxy, { data: { createTopic } }: { data: AddTopicMutation }) => {
                    // Read the data from our cache for this query.
                    const data = proxy.readQuery<AllTopicsQuery>({
                        query: ALL_TOPICS_QUERY
                    });
                    // Add our todo from the mutation to the end.
                    data.allTopics.push(createTopic);
                    data.allTopics.sort(orderTopicByBeginAsc);
                    // Write our data back to the cache.
                    proxy.writeQuery({ query: ALL_TOPICS_QUERY, data });
                }
            })
    })
});

const updateTopic = graphql<UpdateTopicMutation>(UPDATE_TOPIC_MUTATION, {
    props: ({ mutate, ownProps }) => ({
        ...ownProps,
        updateTopic: (update: TopicUpdate) =>
            mutate({
                variables: {
                    id: update.id,
                    title: update.title,
                    description: update.description,
                    isTalk: update.isTalk,
                    begin: update.begin ? update.begin.toISOString() : null,
                    locationId: update.locationId
                },
                update: (proxy, { data: { createTopic } }: { data: AddTopicMutation }) => {
                    // Read the data from our cache for this query.
                    const data = proxy.readQuery<AllTopicsQuery>({
                        query: ALL_TOPICS_QUERY
                    });
                    data.allTopics.sort(orderTopicByBeginAsc);
                    // Write our data back to the cache.
                    proxy.writeQuery({ query: ALL_TOPICS_QUERY, data });
                }
            })
    })
});

function orderTopicByBeginAsc(a: TopicDisplayFragment, b: TopicDisplayFragment): number {
    if (a.begin === b.begin) return 0;
    if (a.begin === null) return -1;
    if (b.begin === null) return 1;
    if (Moment(a.begin).isBefore(b.begin)) return -1;
    if (Moment(b.begin).isBefore(a.begin)) return 1;
    return 0;
}

const deleteTopic = graphql<DeleteTopicMutation>(DELETE_TOPIC_MUTATION, {
    props: ({ mutate, ownProps }) => ({
        ...ownProps,
        deleteTopic: (topicId: string) =>
            mutate({
                variables: { topicId },
                update: (proxy, { data: { deleteTopic } }: { data: DeleteTopicMutation }) => {
                    // Read the data from our cache for this query.
                    const data = proxy.readQuery<AllTopicsQuery>({
                        query: ALL_TOPICS_QUERY
                    });
                    // Remove our topic from the cached topics
                    data.allTopics = data.allTopics.filter(t => t.id != deleteTopic.id);
                    // Write our data back to the cache.
                    proxy.writeQuery({ query: ALL_TOPICS_QUERY, data });
                }
            })
    })
});

/* TODO: maybe use factory pattern and define types manually */
const joinTopicAsExpert = graphql<JoinAsExpertMutation>(JOIN_AS_EXPERT_MUTATION, {
    props: ({ mutate, ownProps }) => ({
        ...ownProps,
        joinAsExpert: (userId: string, topicId: string) =>
            mutate({ variables: { userId, topicId } })
    })
});

const joinTopicAsNewbie = graphql<JoinAsExpertMutation>(JOIN_AS_NEWBIE_MUTATION, {
    props: ({ mutate, ownProps }) => ({
        ...ownProps,
        joinAsNewbie: (userId: string, topicId: string) =>
            mutate({ variables: { userId, topicId } })
    })
});

const leaveTopicAsExpert = graphql<JoinAsExpertMutation>(LEAVE_AS_EXPERT_MUTATION, {
    props: ({ mutate, ownProps }) => ({
        ...ownProps,
        leaveAsExpert: (userId: string, topicId: string) =>
            mutate({ variables: { userId, topicId } })
    })
});

const leaveTopicAsNewbie = graphql<JoinAsExpertMutation>(LEAVE_AS_NEWBIE_MUTATION, {
    props: ({ mutate, ownProps }) => ({
        ...ownProps,
        leaveAsNewbie: (userId: string, topicId: string) =>
            mutate({ variables: { userId, topicId } })
    })
});

const loadTopic = graphql<AllTopicsQuery>(ALL_TOPICS_QUERY, {
    props: ({ data, ownProps }) => ({
        ...ownProps,
        error: data.error,
        loading: data.loading,
        allTopics: data.allTopics
    })
});

interface ExternalProps {
    allTopics: TopicDisplayFragment[];
    user: User;
}
interface InjectedProps {
    topics: TopicViewModel[];
}
function topicConverter<Props extends {}>(
    Comp:
        | React.ComponentClass<Props & InjectedProps>
        | React.StatelessComponent<Props & InjectedProps>
) {
    return class extends React.Component<Props & ExternalProps> {
        constructor(props: Props & ExternalProps) {
            super(props);
            this.props;
        }

        private convertTopics(props: ExternalProps): TopicViewModel[] {
            return (props.allTopics || []).map(topic => ({
                ...topic,
                userIsExpert: topic.experts.some(u => u.id == props.user.id),
                userIsNewbie: topic.newbies.some(u => u.id == props.user.id),
                canManage: props.user.isAdmin
            }));
        }

        render() {
            const topics = this.convertTopics(this.props);
            return <Comp topics={topics} {...this.props} />;
        }
    };
}

export const TopicConnector = compose(
    addTopic,
    updateTopic,
    deleteTopic,
    joinTopicAsExpert,
    joinTopicAsNewbie,
    leaveTopicAsExpert,
    leaveTopicAsNewbie,
    loadTopic,
    withUser,
    topicConverter
);
