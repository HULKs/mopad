import * as React from "react";
import gql from "graphql-tag";
import graphql from "react-apollo/graphql";
import { AllTalksQueryQuery } from "../../../mopad-graphql";
import { ApolloError } from "apollo-client";

interface PublicProps {}

interface TalkListProps {
    loading: boolean;
    error: ApolloError;
    talks: AllTalksQueryQuery["allTalks"];
}

type Props = PublicProps & TalkListProps;

class TalkList extends React.PureComponent<Props> {
    public render() {
        if (this.props.loading) {
            return "loading...";
        }

        if (this.props.error) {
            return <pre>{this.props.error.message}</pre>;
        }

        return <ul>{this.renderTalks()}</ul>;
    }

    private renderTalks() {
        return this.props.talks.map(talk => (
            <li key={talk.id}>{talk.title}</li>
        ));
    }
}

const ALL_TALKS_QUERY = gql`
    query AllTalksQuery {
        allTalks {
            id
            title
        }
    }
`;

export default graphql<AllTalksQueryQuery, PublicProps, TalkListProps>(
    ALL_TALKS_QUERY,
    {
        props: ({ data }) => ({
            error: data.error,
            loading: data.loading,
            talks: data.allTalks
        })
    }
)(TalkList);
