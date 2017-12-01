import * as React from "react";
import { FormattedMessage } from "react-intl";
import TopicList from "./topicList";
import TopicAdd from "./topicAdd";
import { ApolloError } from "apollo-client";
import { ISessionStore, LocalSessionStore } from "../../business/auth";
import { ParticipationType, ParticipationChange } from "../../business/types";
import { TopicConnector, TopicViewModel } from "../../business/topics";

interface PublicProps {}
interface HomeProps {
    error: ApolloError;
    loading: boolean;
    topics: TopicViewModel[];
    addTopic(title: string, description?: string);
    joinAsExpert(userId: string, topicId: string);
    joinAsNewbie(userId: string, topicId: string);
    leaveAsExpert(userId: string, topicId: string);
    leaveAsNewbie(userId: string, topicId: string);
}
type Props = PublicProps & HomeProps;

export class Home extends React.Component<Props> {
    private sessionStore: ISessionStore;
    private actionMap: {
        [action: string]: (userId: string, topicId: string) => any;
    };

    constructor(props: Props) {
        super(props);

        this.sessionStore = new LocalSessionStore();
        this.onTopicAdd = this.onTopicAdd.bind(this);
        this.onChangeParticipation = this.onChangeParticipation.bind(this);
        this.actionMap = {
            "join:expert": this.props.joinAsExpert,
            "join:newbie": this.props.joinAsNewbie,
            "leave:expert": this.props.leaveAsExpert,
            "leave:newbie": this.props.leaveAsNewbie
        };
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
        const actionString = `${action}:${type}`;
        if (!this.actionMap.hasOwnProperty(actionString)) {
            throw new Error("invalid change of participation");
        }
        this.actionMap[actionString](this.sessionStore.userId, topicId);
    }
}

export default TopicConnector(Home);
