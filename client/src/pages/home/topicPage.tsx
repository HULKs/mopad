import * as React from "react";
import { FormattedMessage } from "react-intl";
import { ApolloError } from "apollo-client";
import TopicList from "./topicList";
import TopicAdd from "./topicAdd";
import TopicFilterSelector from "./topicFilterSelector";
import { withUser, User } from "../../business/withUser";
import { ParticipationType, ParticipationChange } from "../../business/types";
import {
    TopicConnector,
    TopicViewModel,
    TopicUpdate
} from "../../business/topics";

interface PublicProps {}
interface HomeProps {
    error: ApolloError;
    loading: boolean;
    topics: TopicViewModel[];
    user: User;
    addTopic(title: string, description?: string);
    updateTopic(update: TopicUpdate);
    deleteTopic(topicId: string);
    joinAsExpert(userId: string, topicId: string);
    joinAsNewbie(userId: string, topicId: string);
    leaveAsExpert(userId: string, topicId: string);
    leaveAsNewbie(userId: string, topicId: string);
}
type Props = PublicProps & HomeProps;
interface State {
    filterUserTopics: boolean;
}

export class DisconnectedTopicsPage extends React.Component<Props, State> {
    private actionMap: {
        [action: string]: (userId: string, topicId: string) => any;
    };

    constructor(props: Props) {
        super(props);
        this.state = {
            filterUserTopics: false
        };

        this.onTopicAdd = this.onTopicAdd.bind(this);
        this.onChangeParticipation = this.onChangeParticipation.bind(this);
        this.onUpdateTopic = this.onUpdateTopic.bind(this);
        this.onDeleteTopic = this.onDeleteTopic.bind(this);
        this.onFilterChange = this.onFilterChange.bind(this);
        this.actionMap = {
            "join:expert": this.props.joinAsExpert,
            "join:newbie": this.props.joinAsNewbie,
            "leave:expert": this.props.leaveAsExpert,
            "leave:newbie": this.props.leaveAsNewbie
        };
    }

    public render() {
        const { filterUserTopics } = this.state;
        return (
            <div className="page">
                <div className="pageHeader">
                    <h1>
                        <FormattedMessage id="topics.headline" />
                    </h1>
                    <TopicFilterSelector
                        value={filterUserTopics}
                        onChange={this.onFilterChange}
                    />
                </div>
                <TopicList
                    topics={this.getFilteredTopics()}
                    onChangeParticipation={this.onChangeParticipation}
                    onUpdateTopic={this.onUpdateTopic}
                    onDeleteTopic={this.onDeleteTopic}
                />
                <TopicAdd onTopicAdd={this.onTopicAdd} />
            </div>
        );
    }

    private getFilteredTopics() {
        const { topics } = this.props;
        const { filterUserTopics } = this.state;
        return (topics || []).filter(
            t => !filterUserTopics || (t.userIsExpert || t.userIsNewbie)
        );
    }

    private onFilterChange(value) {
        this.setState({ filterUserTopics: value });
    }

    private onTopicAdd(title: string, description: string): void {
        this.props.addTopic(title, description);
    }

    private onChangeParticipation(
        topicId: string,
        type: ParticipationType,
        action: ParticipationChange
    ): void {
        const actionString = `${action}:${type}`;
        if (!this.actionMap.hasOwnProperty(actionString)) {
            throw new Error("invalid change of participation");
        }
        this.actionMap[actionString](this.props.user.id, topicId);
    }

    private onUpdateTopic(update: TopicUpdate) {
        this.props.updateTopic(update);
    }

    private onDeleteTopic(topicId: string) {
        this.props.deleteTopic(topicId);
    }
}

export default TopicConnector(withUser(DisconnectedTopicsPage));
