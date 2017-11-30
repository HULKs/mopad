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
import { AllTopicsQuery } from "../../../mopad-graphql";

interface PublicProps {
    topic: AllTopicsQuery["allTopics"][0];
    onJoin(topicId: string, as: "expert" | "newbie");
}

interface IntlProps {
    intl: InjectedIntl;
}

export class DisconnectedTopic extends React.Component<
    PublicProps & IntlProps
> {
    public render() {
        const { onJoin, intl } = this.props;
        return (
            <Card className="topic card">
                <CardTitle
                    title={this.props.topic.title}
                    subtitle={this.props.topic.description}
                />
                <CardText>
                    <div>
                        Experten:{" "}
                        {this.props.topic.experts.map(u => u.name).join(", ")}
                    </div>
                    <div>
                        Newbies:{" "}
                        {this.props.topic.newbies.map(u => u.name).join(", ")}
                    </div>
                </CardText>
                <CardActions>
                    <FlatButton
                        onClick={() => onJoin(this.props.topic.id, "expert")}
                        label={intl.formatMessage({ id: "topic.join.expert" })}
                    />
                    <FlatButton
                        onClick={() => onJoin(this.props.topic.id, "newbie")}
                        label={intl.formatMessage({ id: "topic.join.newbie" })}
                    />
                </CardActions>
            </Card>
        );
    }
}

export default injectIntl<PublicProps>(DisconnectedTopic);
