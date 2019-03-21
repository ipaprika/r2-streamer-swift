//
//  RDEpubParser.swift
//  r2-streamer-swift
//
//  Created by Olivier Körner on 08/12/2016.
//
//  Copyright 2018 Readium Foundation. All rights reserved.
//  Use of this source code is governed by a BSD-style license which is detailed
//  in the LICENSE file present in the project repository where this source code is maintained.
//

import R2Shared
import AEXML
import Fuzi

/// Epub related constants.
public struct EpubConstant {
    /// Default EPUB Version value, used when no version hes been specified.
    /// (see OPF_2.0.1_draft 1.3.2).
    public static let defaultEpubVersion = 1.2
    /// Path of the EPUB's container.xml file.
    public static let containerDotXmlPath = "META-INF/container.xml"
    /// Path of the EPUB's ecryption file.
    public static let encryptionDotXmlPath = "META-INF/encryption.xml"
    /// Lcpl file path.
    public static let lcplFilePath = "META-INF/license.lcpl"
    /// Epub mime-type.
    public static let mimetype = "application/epub+zip"
    /// http://www.idpf.org/oebps/ (Legacy).
    public static let mimetypeOEBPS = "application/oebps-package+xml"
    /// Media Overlays URL.
    public static let mediaOverlayURL = "media-overlay?resource="
}

/// Errors thrown during the parsing of the EPUB
///
/// - wrongMimeType: The mimetype file is missing or its content differs from
///                 "application/epub+zip" (expected).
/// - missingFile: A file is missing from the container at `path`.
/// - xmlParse: An XML parsing error occurred.
/// - missingElement: An XML element is missing.
public enum EpubParserError: LocalizedError {
    case wrongMimeType
    case missingFile(path: String)
    case xmlParse(underlyingError: Error)
    case missingElement(message: String)

    public var errorDescription: String? {
        switch self {
        case .wrongMimeType:
            return "The mimetype of the Epub is not valid."
        case .missingFile(let path):
            return "The file '\(path)' is missing."
        case .xmlParse(let underlyingError):
            return "Error while parsing XML (\(underlyingError))."
        case .missingElement(let message):
            return "Missing element: \(message)."
        }
    }
}

extension EpubParser: Loggable {}

/// An EPUB container parser that extracts the information from the relevant
/// files and builds a `Publication` instance out of it.
final public class EpubParser: PublicationParser {
    /// Parses the EPUB (file/directory) at `fileAtPath` and generate the
    /// corresponding `Publication` and `Container`.
    ///
    /// - Parameter fileAtPath: The path to the epub file.
    /// - Returns: The Resulting publication, and a callback for parsing the
    ///            possibly DRM encrypted in the publication. The callback need
    ///            to be called by sending back the DRM object (or nil).
    ///            The point is to get DRM informations in the DRM object, and
    ///            inform the decypher() function in  the DRM object to allow
    ///            the fetcher to decypher encrypted resources.
    /// - Throws: `EpubParserError.wrongMimeType`,
    ///           `EpubParserError.xmlParse`,
    ///           `EpubParserError.missingFile`
    static public func parse(fileAtPath path: String) throws -> (PubBox, PubParsingCallback) {
        // Generate the `Container` for `fileAtPath`
        var container = try generateContainerFrom(fileAtPath: path)

        // Get the package.opf XML document from the container.
        let documentData = try container.data(relativePath: container.rootFile.rootFilePath)
        let document = try AEXMLDocument(xml: documentData)
        let epubVersion = getEpubVersion(from: document)
        
        // Parse OPF file (Metadata, ReadingOrder, Resource) and return the Publication.
        var publication = try OPFParser.parseOPF(from: document,
                                                 with: container.rootFile.rootFilePath,
                                                 and: epubVersion)
        
        // Check if the publication is DRM protected.
        let drm = scanForDRM(in: container)
        // Parse the META-INF/Encryption.xml.
        parseEncryption(from: container, to: &publication, drm)

        func parseRemainingResource(protectedBy drm: DRM?) throws {
            /// The folowing resources could be encrypted, hence we use the fetcher.
            let fetcher = try Fetcher(publication: publication, container: container)

            container.drm = drm

            fillEncryptionProfile(forLinksIn: publication, using: drm)
            try parseMediaOverlay(from: fetcher, to: &publication)
            parseNavigationDocument(from: fetcher, to: &publication)
            
            if publication.toc.isEmpty || publication.pageList.isEmpty {
                parseNcxDocument(from: fetcher, to: &publication)
            }
        }
        container.drm = drm
        return ((publication, container), parseRemainingResource)
    }

    // MARK: - Internal Methods.

    /// Parse the Encryption.xml EPUB file. It contains the informationg about
    /// encrypted resources and how to decrypt them
    ///
    /// - Parameters:
    ///   - container: The EPUB Container.
    ///   - publication: The Publication.
    /// - Throws: 
    static internal func parseEncryption(from container: Container, to publication: inout Publication, _ drm: DRM?) {
        //if publication.metadata.title ==
        // Check if there is an encryption file.
        guard let documentData = try? container.data(relativePath: EpubConstant.encryptionDotXmlPath),
            let document = try? AEXMLDocument.init(xml: documentData) else {
                // To encryption document.
                return
        }
        // Are any files encrypted.
        guard let encryptedDataElements = document["encryption"]["EncryptedData"].all else {
            log(.info, "No <EncryptedData> elements")
            return
        }

        // Loop through <EncryptedData> elements..
        for encryptedDataElement in encryptedDataElements {
            guard let algorithm = encryptedDataElement["EncryptionMethod"].attributes["Algorithm"] else {
                continue
            }
            
            var encryption = EPUBEncryption(algorithm: algorithm)
            
            // LCP. Tag LCP protected resources.
            let keyInfoUri = encryptedDataElement["KeyInfo"]["RetrievalMethod"].attributes["URI"]
            if keyInfoUri == "license.lcpl#/encryption/content_key",
                drm?.brand == DRM.Brand.lcp
            {
                encryption.scheme = drm?.scheme.rawValue
            }
            // LCP END.

            EncryptionParser.parseEncryptionProperties(from: encryptedDataElement, to: &encryption)
            EncryptionParser.add(encryption: encryption, toLinkInPublication: &publication,
                     encryptedDataElement)
        }
    }

    /// WIP, currently only LCP.
    /// Scan Container (but later Publication too probably) to know if any DRM
    /// are protecting the publication.
    ///
    /// - Parameter in: The Publication's Container.
    /// - Returns: The DRM if any found.
    static internal func scanForDRM(in container: Container) -> DRM? {
        /// LCP.
        // Check if a LCP license file is present in the container.
        if ((try? container.data(relativePath: EpubConstant.lcplFilePath)) != nil) {
            return DRM(brand: .lcp)
        }
        /// ADOBE.
        // TODO
        /// SONY.
        // TODO
        return nil
    }

    /// Attempt to fill `Publication.tableOfContent`/`.landmarks`/`.pageList`/
    ///                              `.listOfIllustration`/`.listOftables`
    /// using the navigation document.
    ///
    /// - Parameters:
    ///   - container: The Epub container.
    ///   - publication: The Epub publication.
    static internal func parseNavigationDocument(from fetcher: Fetcher, to publication: inout Publication) {
        // Get the link in the readingOrder pointing to the Navigation Document.
        guard let navLink = publication.link(withRel: "contents"),
            let navDocumentData = try? fetcher.data(forLink: navLink),
            navDocumentData != nil,
            let navDocument = try? AEXMLDocument.init(xml: navDocumentData!),
            let navDocumentFuzi = try? XMLDocument.init(data: navDocumentData!) else
        {
            return
        }
        // Get the location of the navigation document in order to normalize href pathes.
        let navigationDocumentPath = navLink.href
        
        publication.toc = NavigationDocumentParser
            .tableOfContent(fromNavigationDocument: navDocumentFuzi, locatedAt: navigationDocumentPath)
        
        publication.pageList = NavigationDocumentParser
            .pageList(fromNavigationDocument: navDocument, locatedAt: navigationDocumentPath)
        
        publication.landmarks = NavigationDocumentParser
            .landmarks(fromNavigationDocument: navDocument, locatedAt: navigationDocumentPath)
        
        publication.listOfAudioFiles = NavigationDocumentParser
            .listOfAudiofiles(fromNavigationDocument: navDocument, locatedAt: navigationDocumentPath)
        
        publication.listOfIllustrations = NavigationDocumentParser
            .listOfIllustrations(fromNavigationDocument: navDocument, locatedAt: navigationDocumentPath)
        
        publication.listOfTables = NavigationDocumentParser
            .listOfTables(fromNavigationDocument: navDocument, locatedAt: navigationDocumentPath)
        
        publication.listOfVideos = NavigationDocumentParser
            .listOfVideos(fromNavigationDocument: navDocument, locatedAt: navigationDocumentPath)
    }

    /// Attempt to fill `Publication.tableOfContent`/`.pageList` using the NCX
    /// document. Will only modify the Publication if it has not be filled
    /// previously (using the Navigation Document).
    ///
    /// - Parameters:
    ///   - container: The Epub container.
    ///   - publication: The Epub publication.
    static internal func parseNcxDocument(from fetcher: Fetcher, to publication: inout Publication) {
        // Get the link in the readingOrder pointing to the NCX document.
        guard let ncxLink = publication.resources.first(where: { $0.type == "application/x-dtbncx+xml" }),
            let ncxDocumentData = try? fetcher.data(forLink: ncxLink),
            ncxDocumentData != nil,
            let ncxDocument = try? AEXMLDocument.init(xml: ncxDocumentData!) else {
                return
        }
        // Get the location of the NCX document in order to normalize href pathes.
        let ncxDocumentPath = ncxLink.href
        if publication.toc.isEmpty {
            let newTableOfContentItems = NCXParser.tableOfContents(fromNcxDocument: ncxDocument, locatedAt: ncxDocumentPath)
            publication.toc.append(contentsOf: newTableOfContentItems)
        }
        if publication.pageList.isEmpty {
            let newPageListItems = NCXParser.pageList(fromNcxDocument: ncxDocument, locatedAt: ncxDocumentPath)
            publication.pageList.append(contentsOf: newPageListItems)
        }
    }

    /// Parse the mediaOverlays informations contained in the ressources then
    /// parse the associted SMIL files to populate the MediaOverlays objects
    /// in each of the ReadingOrder's Links.
    ///
    /// - Parameters:
    ///   - container: The Epub Container.
    ///   - publication: The Publication object representing the Epub data.
    static internal func parseMediaOverlay(from fetcher: Fetcher, to publication: inout Publication) throws {
        let mediaOverlays = publication.resources.filter({ $0.type ==  "application/smil+xml"})

        guard !mediaOverlays.isEmpty else {
            log(.info, "No media-overlays found in the Publication.")
            return
        }
        for mediaOverlayLink in mediaOverlays {
            let node = MediaOverlayNode()
            
            guard let smilData = try? fetcher.data(forLink: mediaOverlayLink),
                smilData != nil,
                let smilXml = try? AEXMLDocument(xml: smilData!) else
            {
                throw OPFParserError.invalidSmilResource
            }

            let body = smilXml["smil"]["body"]

            node.role.append("section")
            if let textRef = body.attributes["epub:textref"] { // Prevent the crash on the japanese book
                node.text = normalize(base: mediaOverlayLink.href, href: textRef)
            }
            // get body parameters <par>a
            let href = mediaOverlayLink.href
            SMILParser.parseParameters(in: body, withParent: node, base: href)
            SMILParser.parseSequences(in: body, withParent: node, publicationReadingOrder: &publication.readingOrder, base: href)
            // "/??/xhtml/mo-002.xhtml#mo-1" => "/??/xhtml/mo-002.xhtml"
            guard let baseHref = node.text?.components(separatedBy: "#")[0],
                let link = publication.readingOrder.first(where: { baseHref.contains($0.href) }) else
            {
                continue
            }
            link.mediaOverlays.append(node)
            link.properties.mediaOverlay = EpubConstant.mediaOverlayURL + link.href
        }
    }

    // MARK: - Fileprivate Methods.

    /// Parses the container.xml file and retrieve the relative path to the opf
    /// file(rootFilePath) (the default one for now, not handling multiple
    /// renditions).
    ///
    /// - Parameter data: The containerDotXml `Data` representation.
    /// - Throws: `EpubParserError.xmlParse`,
    ///           `EpubParserError.missingElement`.
    static fileprivate func getRootFilePath(from data: Data) throws -> String {
        let containerDotXml: AEXMLDocument

        do {
            containerDotXml = try AEXMLDocument(xml: data)
        } catch {
            throw EpubParserError.xmlParse(underlyingError: error)
        }

        let rootFileElement = containerDotXml["container"]["rootfiles"]["rootfile"]
        // Get the path of the OPF file, relative to the metadata.rootPath.
        guard let opfFilePath = getRelativePathToOPF(from: rootFileElement) else {
            throw EpubParserError.missingElement(message: "Missing rootfile in `container.xml`.")
        }
        return opfFilePath
    }

    /// Retrieves the OPF file path from the fisrt <rootfile> element.
    ///
    /// - Parameter containerXml: The XML container instance.
    /// - Returns: The OPF file path.
    /// - Throws: `EpubParserError.missingElement`.
    static fileprivate func getRelativePathToOPF(from rootFileElement: AEXMLElement) -> String? {
        guard let fullPath = rootFileElement.attributes["full-path"] else {
            return nil
        }
        return fullPath
    }

    /// Retrieve the EPUB version from the package.opf XML document else set it 
    /// to the default value `EpubConstant.defaultEpubVersion`.
    ///
    /// - Parameter containerXml: The XML container instance.
    /// - Returns: The OPF file path.
    static fileprivate func getEpubVersion(from document: AEXMLDocument) -> Double {
        let version: Double

        if let versionAttribute = document["package"].attributes["version"],
            let versionNumber = Double(versionAttribute)
        {
            version = versionNumber
        } else {
            version = EpubConstant.defaultEpubVersion
        }
        return version
    }

    /// Generate a Container instance for the file at `fileAtPath`. It handles
    /// 2 cases, epub files and unwrapped epub directories.
    ///
    /// - Parameter path: The absolute path of the file.
    /// - Returns: The generated Container.
    /// - Throws: `EpubParserError.missingFile`.
    static fileprivate func generateContainerFrom(fileAtPath path: String) throws -> Container {
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: path, isDirectory: &isDirectory) else {
            throw EpubParserError.missingFile(path: path)
        }
        
        var container: Container?
        if isDirectory.boolValue {
            container = DirectoryContainer(directory: path, mimetype: EpubConstant.mimetype)
        } else {
            container = ArchiveContainer(path: path, mimetype: EpubConstant.mimetype)
        }
        
        guard let containerUnwrapped = container else {
            throw EpubParserError.missingFile(path: path)
        }
        
        // Retrieve container.xml data from the Container
        guard let data = try? containerUnwrapped.data(relativePath: EpubConstant.containerDotXmlPath) else {
            throw EpubParserError.missingFile(path: EpubConstant.containerDotXmlPath)
        }
        containerUnwrapped.rootFile.rootFilePath = try getRootFilePath(from: data)
        
        return containerUnwrapped
    }

    /// Called in the callback when the DRM has been informed of the encryption
    /// scheme, in order to fill this information in the encrypted links.
    ///
    /// - Parameters:
    ///   - publication: The Publication.
    ///   - drm: The `DRM` object.
    static fileprivate func fillEncryptionProfile(forLinksIn publication: Publication,
                                                  using drm: DRM?)
    {
        guard let drm = drm else {
            return
        }
        for link in publication.resources {
            if link.properties.encryption?.scheme == drm.scheme.rawValue{
                link.properties.encryption?.profile = drm.license?.encryptionProfile
            }
        }
        for link in publication.readingOrder {
            if link.properties.encryption?.scheme == drm.scheme.rawValue {
                link.properties.encryption?.profile = drm.license?.encryptionProfile
            }
        }
    }
}
