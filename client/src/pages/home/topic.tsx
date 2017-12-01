import * as React from "react";
import {
    Card,
    CardActions,
    CardHeader,
    CardMedia,
    CardTitle,
    CardText
} from "material-ui/Card";
import FlatButton from "material-ui/FlatButton";
import { FormattedMessage, injectIntl, InjectedIntl } from "react-intl";
import { TopicViewModel } from "./homePage";
import { ParticipationType, ParticipationChange } from "../../business/types";

interface PublicProps {
    topic: TopicViewModel;
    onChangeParticipation(
        topicId: string,
        as: ParticipationType,
        action: ParticipationChange
    );
}

interface IntlProps {
    intl: InjectedIntl;
}

export class DisconnectedTopic extends React.Component<
    PublicProps & IntlProps
> {
    public render() {
        const { onChangeParticipation, intl, topic } = this.props;
        return (
            <Card className="topic card">
                <CardTitle
                    title={topic.title}
                    subtitle={topic.description}
                    titleColor={
                        topic.userIsExpert || topic.userIsNewbie
                            ? "red"
                            : "black"
                    }
                />
                <CardText>
                    <div>
                        <FormattedMessage id="topic.label.expert" />:{" "}
                        {topic.experts.map(u => u.name).join(", ")}
                    </div>
                    <div>
                        <FormattedMessage id="topic.label.newbie" />:{" "}
                        {topic.newbies.map(u => u.name).join(", ")}
                    </div>
                </CardText>
                <CardActions>
                    <FlatButton
                        onClick={() =>
                            onChangeParticipation(topic.id, "expert", "join")
                        }
                        label={intl.formatMessage({ id: "topic.join.expert" })}
                    />
                    <FlatButton
                        onClick={() =>
                            onChangeParticipation(topic.id, "newbie", "join")
                        }
                        label={intl.formatMessage({ id: "topic.join.newbie" })}
                    />
                </CardActions>
            </Card>
        );
    }
}

export default injectIntl<PublicProps>(DisconnectedTopic);
