/**
 * Unit tests for OData metadata parser and client pagination logic
 */

import { describe, it, expect } from "vitest";
import { parseODataMetadataXmlAsync, findEntitySet } from "../client/odata-metadata.js";
import { assertAllowedUrl } from "../client/ssrf-guard.js";

// Sample OData $metadata XML (simplified but realistic)
const SAMPLE_METADATA_XML = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="1.0" xmlns:edmx="http://schemas.microsoft.com/ado/2007/06/edmx">
  <edmx:DataServices m:DataServiceVersion="3.0" xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata">
    <Schema Namespace="KnessetOdata" xmlns="http://schemas.microsoft.com/ado/2009/11/edm">
      <EntityType Name="Faction">
        <Key><PropertyRef Name="FactionID" /></Key>
        <Property Name="FactionID" Type="Edm.Int32" Nullable="false" />
        <Property Name="FactionName" Type="Edm.String" />
        <Property Name="KnessetNum" Type="Edm.Int32" />
        <Property Name="CountOfMembers" Type="Edm.Int32" />
        <Property Name="IsCurrent" Type="Edm.Boolean" />
      </EntityType>
      <EntityType Name="Person">
        <Key><PropertyRef Name="PersonID" /></Key>
        <Property Name="PersonID" Type="Edm.Int32" Nullable="false" />
        <Property Name="FirstName" Type="Edm.String" />
        <Property Name="LastName" Type="Edm.String" />
        <Property Name="IsCurrent" Type="Edm.Boolean" />
      </EntityType>
      <EntityType Name="Bill">
        <Key><PropertyRef Name="BillID" /></Key>
        <Property Name="BillID" Type="Edm.Int32" Nullable="false" />
        <Property Name="Name" Type="Edm.String" />
        <Property Name="StatusID" Type="Edm.Int32" />
        <Property Name="KnessetNum" Type="Edm.Int32" />
      </EntityType>
      <EntityContainer Name="KnessetDataService" m:IsDefaultEntityContainer="true">
        <EntitySet Name="KnssFaction" EntityType="KnessetOdata.Faction" />
        <EntitySet Name="KnssMember" EntityType="KnessetOdata.Person" />
        <EntitySet Name="KnssBill" EntityType="KnessetOdata.Bill" />
        <EntitySet Name="KnssCommittee" EntityType="KnessetOdata.Committee" />
      </EntityContainer>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;

describe("OData Metadata Parser", () => {
  it("parses entity sets from metadata XML", async () => {
    const metadata = await parseODataMetadataXmlAsync(
      SAMPLE_METADATA_XML,
      "https://knesset.gov.il/Odata/ParliamentInfo.svc",
    );

    expect(metadata.entitySets).toHaveLength(4);
    expect(metadata.entitySets.map((es) => es.name)).toContain("KnssFaction");
    expect(metadata.entitySets.map((es) => es.name)).toContain("KnssMember");
    expect(metadata.entitySets.map((es) => es.name)).toContain("KnssBill");
  });

  it("builds correct entity set URLs", async () => {
    const metadata = await parseODataMetadataXmlAsync(
      SAMPLE_METADATA_XML,
      "https://knesset.gov.il/Odata/ParliamentInfo.svc",
    );

    const faction = metadata.entitySets.find((es) => es.name === "KnssFaction");
    expect(faction?.url).toBe("https://knesset.gov.il/Odata/ParliamentInfo.svc/KnssFaction");
  });

  it("parses entity type properties", async () => {
    const metadata = await parseODataMetadataXmlAsync(
      SAMPLE_METADATA_XML,
      "https://knesset.gov.il/Odata/ParliamentInfo.svc",
    );

    const faction = metadata.entitySets.find((es) => es.name === "KnssFaction");
    expect(faction?.properties).toBeDefined();
    expect(faction?.properties?.map((p) => p.name)).toContain("FactionID");
    expect(faction?.properties?.map((p) => p.name)).toContain("FactionName");
  });

  it("handles empty metadata gracefully", async () => {
    const emptyXml = `<?xml version="1.0" encoding="utf-8"?>
    <edmx:Edmx Version="1.0" xmlns:edmx="http://schemas.microsoft.com/ado/2007/06/edmx">
      <edmx:DataServices><Schema xmlns="http://schemas.microsoft.com/ado/2009/11/edm" /></edmx:DataServices>
    </edmx:Edmx>`;

    const metadata = await parseODataMetadataXmlAsync(emptyXml, "https://knesset.gov.il/test");
    expect(metadata.entitySets).toHaveLength(0);
  });
});

describe("findEntitySet", () => {
  it("finds entity set by exact name", async () => {
    const metadata = await parseODataMetadataXmlAsync(
      SAMPLE_METADATA_XML,
      "https://knesset.gov.il/Odata/ParliamentInfo.svc",
    );

    const result = findEntitySet(metadata, ["KnssFaction"]);
    expect(result).toBeDefined();
    expect(result?.name).toBe("KnssFaction");
  });

  it("finds entity set by partial match", async () => {
    const metadata = await parseODataMetadataXmlAsync(
      SAMPLE_METADATA_XML,
      "https://knesset.gov.il/Odata/ParliamentInfo.svc",
    );

    const result = findEntitySet(metadata, ["Faction"]);
    expect(result).toBeDefined();
    expect(result?.name).toBe("KnssFaction");
  });

  it("returns undefined when entity set not found", async () => {
    const metadata = await parseODataMetadataXmlAsync(
      SAMPLE_METADATA_XML,
      "https://knesset.gov.il/Odata/ParliamentInfo.svc",
    );

    const result = findEntitySet(metadata, ["NonExistent", "AlsoNotFound"]);
    expect(result).toBeUndefined();
  });

  it("tries candidates in priority order", async () => {
    const metadata = await parseODataMetadataXmlAsync(
      SAMPLE_METADATA_XML,
      "https://knesset.gov.il/Odata/ParliamentInfo.svc",
    );

    // KnssMember exists, KnessetMember doesn't
    const result = findEntitySet(metadata, ["KnessetMember", "KnssMember"]);
    expect(result?.name).toBe("KnssMember");
  });
});

describe("SSRF Guard", () => {
  it("allows knesset.gov.il", () => {
    expect(() => assertAllowedUrl("https://knesset.gov.il/Odata/ParliamentInfo.svc")).not.toThrow();
  });

  it("allows main.knesset.gov.il subdomain", () => {
    expect(() => assertAllowedUrl("https://main.knesset.gov.il/test")).not.toThrow();
  });

  it("allows gov.il", () => {
    expect(() => assertAllowedUrl("https://gov.il/test")).not.toThrow();
  });

  it("blocks arbitrary domains", () => {
    expect(() => assertAllowedUrl("https://malicious.com/steal-data")).toThrow(/SSRF protection/);
  });

  it("blocks internal IPs", () => {
    expect(() => assertAllowedUrl("http://169.254.169.254/metadata")).toThrow(/SSRF protection/);
  });

  it("blocks localhost", () => {
    expect(() => assertAllowedUrl("http://localhost:8080/internal")).toThrow(/SSRF protection/);
  });

  it("throws on invalid URL", () => {
    expect(() => assertAllowedUrl("not-a-url")).toThrow(/Invalid URL/);
  });
});

describe("Bill topic inference", () => {
  it("infers healthcare topic", async () => {
    const { inferTopic } = await import("../mappers/bill-mapper.js");
    const topic = inferTopic("חוק בריאות הציבור", null);
    expect(topic).toBe("healthcare");
  });

  it("infers economy topic", async () => {
    const { inferTopic } = await import("../mappers/bill-mapper.js");
    const topic = inferTopic("חוק מיסוי מקרקעין", null);
    expect(topic).toBe("economy");
  });

  it("returns null for empty input", async () => {
    const { inferTopic } = await import("../mappers/bill-mapper.js");
    const topic = inferTopic(null, null);
    expect(topic).toBeNull();
  });

  it("returns other for unrecognized topic", async () => {
    const { inferTopic } = await import("../mappers/bill-mapper.js");
    const topic = inferTopic("נושא שאינו מוכר xyzabc", null);
    expect(topic).toBe("other");
  });
});
